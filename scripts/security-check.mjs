// Privilege-escalation regression test. Signs in as the technician Benny and attacks every
// layer: URL guard, pages, API routes, forged tokens, the database API directly (the
// publishable key is public), storage, and office roles bypassing the audited workflow.
// Needs the dev server running and the seeded demo data. It changes nothing permanently:
// anything an attack manages to alter is restored with the service role.
// Usage: npm run security:check     (exit code 1 if any attack gets through)
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

/** RFC 6238 TOTP (what Google / Microsoft Authenticator compute), for the 2FA attacks. */
function totp(secret, t = Date.now()) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += A.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
  const h = crypto.createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0");
}

const BASE = process.env.BASE_URL || "http://localhost:3000";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ref = new URL(URL_).hostname.split(".")[0];
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = [];
const record = (layer, attack, blocked, detail) => results.push({ layer, attack, blocked, detail });

function cookieHeader(session) {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const chunks = [];
  for (let i = 0; i < value.length; i += 3180) chunks.push(value.slice(i, i + 3180));
  return chunks.map((c, i) => `${chunks.length === 1 ? `sb-${ref}-auth-token` : `sb-${ref}-auth-token.${i}`}=${c}`).join("; ");
}

async function hit(path, cookie, init = {}) {
  const res = await fetch(BASE + path, { redirect: "manual", ...init, headers: { ...(init.headers || {}), ...(cookie ? { cookie } : {}) } });
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location") || "", body };
}

// A page counts as leaked if it renders with office-only markers in the HTML.
const OFFICE_MARKERS = [/Admin Console/, /Manager Hub/, /Users &amp; roles/, /Integrity verified/, /Dispatch/];
function leaked(r) {
  return r.status === 200 && OFFICE_MARKERS.some((m) => m.test(r.body));
}

(async () => {
  // ---------- targets (service role, read-only) ----------
  const { data: benny } = await svc.from("profiles").select("id, role").eq("email", "benny.tech@sejuk.com").single();
  const { data: bennyTech } = await svc.from("technicians").select("id").eq("profile_id", benny.id).single();
  const { data: otherOrder } = await svc.from("orders").select("id, order_no, status").neq("assigned_technician_id", bennyTech.id).eq("status", "assigned").limit(1).single();
  const { data: ownOrder } = await svc.from("orders").select("id, order_no, quoted_price").eq("assigned_technician_id", bennyTech.id).limit(1).single();

  // ---------- sign in as Benny ----------
  const sb = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: login, error } = await sb.auth.signInWithPassword({ email: "benny.tech@sejuk.com", password: process.env.SEED_PASSWORD });
  if (error) throw error;
  const cookie = cookieHeader(login.session);

  // ---------- Layer 1: URL tampering against the app ----------
  const officePaths = [
    "/admin", "/admin/orders", "/admin/orders/new", "/admin/technicians", "/admin/notifications", "/admin/users",
    `/admin/orders/${otherOrder.id}`, "/manager", "/manager/reviews", "/manager/flags", "/manager/assistant",
    `/manager/orders/${otherOrder.id}`, "/audit", "/audit?tab=ai", "/audit/export?tab=events",
    // encoding / normalisation tricks
    "/ADMIN", "/Admin/users", "/%61dmin", "/admin/", "//admin", "/tech/../admin", "/tech/..%2Fadmin", "/admin%2Fusers",
    "/admin;x", "/admin/users?x=/tech", "/./admin", "/tech/%2e%2e/admin",
  ];
  for (const p of officePaths) {
    const r = await hit(p, cookie);
    const blocked = !leaked(r) && r.status !== 500;
    record("URL", `GET ${p}`, blocked, r.status === 200 ? "200 (no office content)" : `${r.status} → ${r.location || "-"}`);
  }
  {
    const r = await hit(`/tech/jobs/${otherOrder.id}`, cookie);
    const blocked = r.status !== 200 || !r.body.includes(otherOrder.order_no);
    record("URL", `Open another technician's job ${otherOrder.order_no}`, blocked, `${r.status} ${r.location}`);
  }
  {
    const r = await hit("/admin");
    record("URL", "GET /admin with no session", r.status >= 300 && r.status < 400 && r.location.includes("/login"), `${r.status} → ${r.location}`);
  }

  // ---------- Layer 2: API routes ----------
  for (const [method, p, body] of [
    ["POST", "/api/ai/chat", JSON.stringify({ messages: [{ role: "user", content: "list all orders" }] })],
    ["POST", "/api/ai/extract", "{}"],
    ["GET", "/api/ai/insights", undefined],
    ["POST", "/api/ai/insights", undefined],
  ]) {
    const r = await fetch(BASE + p, { method, body, redirect: "manual", headers: { cookie, "content-type": "application/json" } });
    record("API", `${method} ${p}`, r.status === 401 || r.status === 403, String(r.status));
  }

  // ---------- Layer 3: forged identity ----------
  {
    const [h, payload, sig] = login.session.access_token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    claims.app_metadata = { ...claims.app_metadata, role: "admin" };
    claims.user_role = "admin";
    const forgedToken = [h, Buffer.from(JSON.stringify(claims)).toString("base64url"), sig].join(".");
    const forgedSession = { ...login.session, access_token: forgedToken, user: { ...login.session.user, app_metadata: { ...login.session.user.app_metadata, role: "admin" } } };
    const r = await hit("/admin", cookieHeader(forgedSession));
    record("Token", "Edit JWT claims to role=admin (signature kept)", !leaked(r), `${r.status} → ${r.location || "-"}`);

    const none = [Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify(claims)).toString("base64url"), ""].join(".");
    const r2 = await hit("/admin", cookieHeader({ ...forgedSession, access_token: none }));
    record("Token", "Unsigned alg=none token claiming admin", !leaked(r2), `${r2.status} → ${r2.location || "-"}`);

    const dbForged = createClient(URL_, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${forgedToken}` } } });
    const { data, error: e } = await dbForged.from("customers").select("id").limit(1);
    record("Token", "Forged JWT against the database API", !!e || (data ?? []).length === 0, e ? e.message.slice(0, 60) : `${data.length} rows`);
  }
  {
    // user_metadata is user-editable; nothing may trust it.
    const { error: e } = await sb.auth.updateUser({ data: { role: "admin" } });
    const { data: refreshed } = await sb.auth.refreshSession();
    const r = await hit("/admin", cookieHeader(refreshed.session));
    const appRole = refreshed.session.user.app_metadata.role;
    record("Token", "Set own user_metadata.role=admin, then open /admin", !leaked(r) && appRole === "technician", `update ${e ? "refused" : "accepted"}; app role still ${appRole}; /admin ${r.status} → ${r.location}`);
    await sb.auth.updateUser({ data: { role: null } });
  }

  // ---------- Layer 4: direct database API with Benny's own token ----------
  const db = sb;
  {
    const { data } = await db.from("profiles").update({ role: "admin" }).eq("id", benny.id).select();
    const { data: after } = await svc.from("profiles").select("role").eq("id", benny.id).single();
    record("DB", "UPDATE own profiles.role = admin", (data ?? []).length === 0 && after.role === "technician", `rows ${data?.length ?? 0}; role is ${after.role}`);
  }
  {
    const { error: e } = await db.from("profiles").insert({ id: crypto.randomUUID(), email: "x@x.com", full_name: "x", role: "admin" });
    record("DB", "INSERT a new admin profile", !!e, e?.message.slice(0, 70));
  }
  {
    const { data } = await db.from("technicians").update({ active: false }).neq("id", bennyTech.id).select();
    record("DB", "UPDATE other technicians", (data ?? []).length === 0, `rows ${data?.length ?? 0}`);
  }
  {
    const { data } = await db.from("orders").update({ quoted_price: 1 }).eq("id", ownOrder.id).select();
    record("DB", "UPDATE price on own order", (data ?? []).length === 0, `rows ${data?.length ?? 0}`);
  }
  for (const t of ["customers", "ai_runs", "ai_flags", "ai_insights", "user_admin_events", "audit_chain_head"]) {
    const { data, error: e } = await db.from(t).select("*").limit(5);
    record("DB", `SELECT ${t}`, !!e || (data ?? []).length === 0, e ? e.message.slice(0, 50) : `${data.length} rows`);
  }
  {
    const { count } = await db.from("orders").select("id", { count: "exact", head: true });
    const { count: mine } = await svc.from("orders").select("id", { count: "exact", head: true }).eq("assigned_technician_id", bennyTech.id);
    const { count: all } = await svc.from("orders").select("id", { count: "exact", head: true });
    record("DB", "SELECT all orders", count === mine, `sees ${count} (own ${mine}, total ${all})`);
  }
  {
    const { data } = await db.from("order_events").delete().eq("order_id", ownOrder.id).select();
    record("DB", "DELETE own audit events", (data ?? []).length === 0, `rows ${data?.length ?? 0}`);
    const { error: e } = await db.from("order_events").insert({ order_id: ownOrder.id, action: "closed", actor_role: "admin" });
    record("DB", "INSERT a forged audit event", !!e, e?.message.slice(0, 60));
  }
  const rpcs = [
    ["create_order", { p_customer_name: "x", p_customer_phone: "0123456789", p_customer_address: "x", p_service_type_id: 1, p_problem_description: "x", p_quoted_price: 1, p_assigned_technician_id: null, p_admin_notes: null, p_scheduled_at: null, p_branch_id: 1, p_source: "manual" }],
    ["assign_technician", { p_order_id: otherOrder.id, p_technician_id: bennyTech.id }],
    ["start_job", { p_order_id: otherOrder.id }],
    ["review_job", { p_order_id: ownOrder.id, p_decision: "approved", p_rating: 5, p_notes: "x" }],
    ["close_job", { p_order_id: ownOrder.id }],
    ["reschedule_order", { p_order_id: otherOrder.id, p_new_scheduled_at: new Date().toISOString(), p_reason: "x" }],
    ["reset_audit_chain", {}],
    ["verify_audit_chain", {}],
    ["sync_order_no_seq", {}],
    ["peek_next_order_no", {}],
    ["mfa_enrolled_users", {}],
    ["cancel_order", { p_order_id: otherOrder.id, p_reason: "duplicate" }],
  ];
  for (const [fn, args] of rpcs) {
    const { data, error: e } = await db.rpc(fn, args);
    record("DB", `RPC ${fn}`, !!e, e ? e.message.slice(0, 70) : `ACCEPTED ${JSON.stringify(data).slice(0, 60)}`);
  }
  {
    const { data } = await db.rpc("search_orders", { p_query: otherOrder.order_no, p_limit: 5 });
    record("DB", `search_orders for another tech's ${otherOrder.order_no}`, (data ?? []).length === 0, `${data?.length ?? 0} hits`);
  }
  {
    // A customer WhatsApp message on one of Benny's own jobs (he can see and open it).
    const { data: ownIds } = await svc.from("orders").select("id").eq("assigned_technician_id", bennyTech.id);
    const { data: n } = await svc.from("notifications").select("id, message, deep_link, recipient_profile_id, status")
      .in("order_id", ownIds.map((o) => o.id)).eq("channel", "whatsapp").eq("audience", "customer").limit(1).single();
    const { data } = await db.from("notifications").update({ deep_link: "https://evil.example/phish", message: "Pay here: https://evil.example", recipient_profile_id: benny.id }).eq("id", n.id).select();
    const hijacked = (data ?? []).length > 0;
    record("DB", "Rewrite a customer WhatsApp message/link on own job", !hijacked, hijacked ? "ACCEPTED (link rewritten)" : "refused");
    if (hijacked) await svc.from("notifications").update({ deep_link: n.deep_link, message: n.message, recipient_profile_id: n.recipient_profile_id }).eq("id", n.id);
    // The one legitimate write must still work: marking it opened.
    const { data: ok, error: okErr } = await db.from("notifications").update({ status: n.status }).eq("id", n.id).select("id");
    record("DB", "(allowed) mark own customer message as opened", true, okErr ? `BROKEN: ${okErr.message}` : `${ok.length} row`);
    if (okErr || !ok.length) results[results.length - 1].blocked = false;
  }
  {
    const { data: profs } = await db.from("profiles").select("email, role");
    const { data: techs } = await db.from("technicians").select("name, phone");
    const onlySelf = profs.length === 1 && profs[0].email === "benny.tech@sejuk.com" && techs.length === 1;
    record("DB", "Read staff directory (emails, roles, phones)", onlySelf, `${profs.length} profile(s), ${techs.length} technician record(s)`);
  }

  // ---------- Layer 5: storage ----------
  {
    // Plant a real (non-sample) file on another technician's order, then try to read it.
    const path = `${otherOrder.id}/pentest-private.txt`;
    await svc.storage.from("job-media").upload(path, new Blob(["private"]), { upsert: true });
    const { data: list } = await db.storage.from("job-media").list(otherOrder.id);
    record("Storage", "List another order's files", (list ?? []).length === 0, `${list?.length ?? 0} visible`);
    const { data: signed, error: e1 } = await db.storage.from("job-media").createSignedUrl(path, 60);
    record("Storage", "Signed URL for another order's private file", !signed, e1?.message.slice(0, 60));
    const { data: dl } = await db.storage.from("job-media").download(path);
    record("Storage", "Download another order's private file", !dl, dl ? "downloaded" : "refused");
    const up = `${otherOrder.id}/pentest.txt`;
    const { error: e } = await db.storage.from("job-media").upload(up, new Blob(["x"]), { upsert: true });
    record("Storage", "Upload into another order's folder", !!e, e?.message.slice(0, 60));
    await svc.storage.from("job-media").remove([path, up]);
  }

  // ---------- Layer 6: office roles cannot bypass the audited workflow ----------
  for (const [email, label] of [["jialok.admin@sejuk.com", "Admin"], ["manager@sejuk.demo", "Manager"]]) {
    const c = createClient(URL_, ANON, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email, password: process.env.SEED_PASSWORD });
    const { data: o } = await c.from("orders").update({ quoted_price: 1 }).eq("id", ownOrder.id).select();
    record("Office", `${label}: edit order price directly (no audit event)`, (o ?? []).length === 0, `rows ${o?.length ?? 0}`);
    const { data: cu } = await c.from("customers").update({ name: "x" }).neq("id", "00000000-0000-0000-0000-000000000000").select();
    record("Office", `${label}: edit customers directly`, (cu ?? []).length === 0, `rows ${cu?.length ?? 0}`);
    const { data: f } = await c.from("ai_flags").update({ severity: "low", explanation: "nothing to see" }).eq("resolved", false).select();
    record("Office", `${label}: rewrite AI supervisor findings`, (f ?? []).length === 0, `rows ${f?.length ?? 0}`);
    const { data: p } = await c.from("profiles").update({ role: "admin" }).eq("email", "benny.tech@sejuk.com").select();
    record("Office", `${label}: change a role outside audited user admin`, (p ?? []).length === 0, `rows ${p?.length ?? 0}`);
  }

  // ---------- Layer 7: two-factor authentication (password stolen, no phone) ----------
  {
    const email = "siva.tech@sejuk.com";
    const { data: who } = await svc.from("profiles").select("id").eq("email", email).single();
    const purge = async () => {
      const { data } = await svc.auth.admin.mfa.listFactors({ userId: who.id });
      for (const f of data?.factors ?? []) await svc.auth.admin.mfa.deleteFactor({ userId: who.id, id: f.id });
    };
    await purge();
    // The real owner turns 2FA on.
    const owner = createClient(URL_, ANON, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password: process.env.SEED_PASSWORD });
    const { data: en } = await owner.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app", issuer: "Sejuk Ops" });
    const { error: enErr } = await owner.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) });
    if (enErr) throw new Error(`2FA setup for the test failed: ${enErr.message}`);

    try {
      // The attacker has the password only: an aal1 session.
      const thief = createClient(URL_, ANON, { auth: { persistSession: false } });
      const { data: s } = await thief.auth.signInWithPassword({ email, password: process.env.SEED_PASSWORD });
      const thiefCookie = cookieHeader(s.session);

      for (const p of ["/tech", "/tech/history", "/"]) {
        const r = await hit(p, thiefCookie);
        const blocked = r.status >= 300 && r.status < 400 && /\/login\/verify/.test(r.location);
        // "/" is redirected by the proxy to /tech first; follow one hop.
        const r2 = !blocked && r.location ? await hit(new URL(r.location, BASE).pathname, thiefCookie) : r;
        const ok = blocked || (r2.status >= 300 && /\/login\/verify/.test(r2.location));
        record("2FA", `Password only, open ${p}`, ok, `${r.status} → ${r.location}${r2 !== r ? ` → ${r2.location}` : ""}`);
      }
      const { count } = await thief.from("orders").select("id", { count: "exact", head: true });
      record("2FA", "Password only, read own jobs via database API", count === 0, `${count} orders`);
      const { data: hits } = await thief.rpc("search_orders", { p_query: "SJK", p_limit: 5 });
      record("2FA", "Password only, search orders", (hits ?? []).length === 0, `${hits?.length ?? 0} hits`);
      const { data: own } = await svc.from("orders").select("id").eq("assigned_technician_id", (await svc.from("technicians").select("id").eq("profile_id", who.id).single()).data.id).eq("status", "assigned").limit(1).maybeSingle();
      if (own) {
        const { error: e } = await thief.rpc("start_job", { p_order_id: own.id });
        record("2FA", "Password only, start own job", !!e, e?.message.slice(0, 60));
        // If an attack ever gets through, undo it (the audit chain keeps the record).
        if (!e) await svc.from("orders").update({ status: "assigned", started_at: null }).eq("id", own.id);
        const { error: rs } = await thief.rpc("reschedule_order", { p_order_id: own.id, p_new_scheduled_at: new Date(Date.now() + 864e5).toISOString(), p_reason: "x" });
        record("2FA", "Password only, reschedule own job", !!rs, rs?.message.slice(0, 60));
      }
      const { data: reviewed } = await svc.from("orders").select("id").eq("status", "reviewed").limit(1).single();
      const { error: cl } = await thief.rpc("close_job", { p_order_id: reviewed.id });
      record("2FA", "Password only, close an order", !!cl, cl?.message.slice(0, 60));
      if (!cl) await svc.from("orders").update({ status: "reviewed", closed_at: null }).eq("id", reviewed.id);
      const { error: un } = await thief.auth.mfa.unenroll({ factorId: en.id });
      record("2FA", "Password only, remove the owner's authenticator", !!un, un?.message.slice(0, 60));
      const { data: rogue, error: re } = await thief.auth.mfa.enroll({ factorType: "totp", friendlyName: "Thief phone" });
      let rogueOk = false;
      if (!re && rogue) {
        const { error: rv } = await thief.auth.mfa.challengeAndVerify({ factorId: rogue.id, code: totp(rogue.totp.secret) });
        const { count: after } = await thief.from("orders").select("id", { count: "exact", head: true });
        rogueOk = !rv && (after ?? 0) > 0;
      }
      record("2FA", "Password only, add own authenticator to skip the code", !rogueOk, re ? re.message.slice(0, 60) : rogueOk ? "BYPASSED" : "enrolment gave no access");
      const { error: guess } = await thief.auth.mfa.challengeAndVerify({ factorId: en.id, code: "123456" });
      record("2FA", "Password only, guess a code", !!guess, guess?.message.slice(0, 60));
    } finally {
      await purge();
    }
  }

  // ---------- Layer 8: private AI conversation history ----------
  {
    const { data: adminProfile } = await svc.from("profiles").select("id").eq("email", "jialok.admin@sejuk.com").single();
    const { data: mgrProfile } = await svc.from("profiles").select("id").eq("email", "manager@sejuk.demo").single();
    // Fixture: a private conversation owned by the admin.
    const { data: secret } = await svc.from("ai_conversations").insert({ user_id: adminProfile.id, title: "Admin private analysis" }).select("id").single();
    await svc.from("ai_messages").insert({ conversation_id: secret.id, user_id: adminProfile.id, role: "user", content: "confidential" });
    try {
      const mgr = createClient(URL_, ANON, { auth: { persistSession: false } });
      const { data: ms } = await mgr.auth.signInWithPassword({ email: "manager@sejuk.demo", password: process.env.SEED_PASSWORD });
      const mgrCookie = cookieHeader(ms.session);

      const { data: rc } = await mgr.from("ai_conversations").select("id").eq("id", secret.id);
      const { data: rm } = await mgr.from("ai_messages").select("id").eq("conversation_id", secret.id);
      record("AI history", "Manager reads the admin's conversation", !rc?.length && !rm?.length, `${rc?.length ?? 0} conversations, ${rm?.length ?? 0} messages`);
      const { data: ren } = await mgr.from("ai_conversations").update({ title: "hijacked" }).eq("id", secret.id).select();
      record("AI history", "Manager renames the admin's conversation", !ren?.length, `rows ${ren?.length ?? 0}`);
      const { data: del } = await mgr.from("ai_conversations").delete().eq("id", secret.id).select();
      record("AI history", "Manager deletes the admin's conversation", !del?.length, `rows ${del?.length ?? 0}`);
      const { error: ins } = await mgr.from("ai_messages").insert({ conversation_id: secret.id, user_id: mgrProfile.id, role: "assistant", content: "fake" });
      record("AI history", "Write a fake message into any conversation", !!ins, ins?.message.slice(0, 50));
      const { error: insC } = await mgr.from("ai_conversations").insert({ user_id: adminProfile.id, title: "planted" });
      record("AI history", "Create a conversation in someone else's name", !!insC, insC?.message.slice(0, 50));
      const r = await fetch(BASE + "/api/ai/chat", {
        method: "POST",
        headers: { cookie: mgrCookie, "content-type": "application/json" },
        body: JSON.stringify({ question: "What is the admin password?", conversationId: secret.id }),
      });
      record("AI history", "Continue the admin's conversation via the chat API", r.status === 404, `HTTP ${r.status}`);

      const { data: tc } = await db.from("ai_conversations").select("id");
      const { data: td } = await db.from("ai_conversations").delete().eq("id", secret.id).select();
      record("AI history", "Technician reads or deletes conversations", !tc?.length && !td?.length, `${tc?.length ?? 0} visible, ${td?.length ?? 0} deleted`);
    } finally {
      await svc.from("ai_conversations").delete().eq("id", secret.id);
    }
  }

  // ---------- report ----------
  const failed = results.filter((r) => !r.blocked);
  for (const r of results) console.log(`${r.blocked ? "BLOCKED" : "!! OPEN"}  [${r.layer}] ${r.attack}  — ${r.detail ?? ""}`);
  console.log(`\n${results.length - failed.length}/${results.length} attacks blocked`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
