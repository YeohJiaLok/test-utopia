// Privilege-escalation regression test. Signs in as the technician Benny and attacks every
// layer: URL guard, pages, API routes, forged tokens, the database API directly (the
// publishable key is public), storage, and office roles bypassing the audited workflow.
// Needs the dev server running and the seeded demo data. It changes nothing permanently:
// anything an attack manages to alter is restored with the service role.
// Usage: npm run security:check     (exit code 1 if any attack gets through)
import { createClient } from "@supabase/supabase-js";

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

  // ---------- report ----------
  const failed = results.filter((r) => !r.blocked);
  for (const r of results) console.log(`${r.blocked ? "BLOCKED" : "!! OPEN"}  [${r.layer}] ${r.attack}  — ${r.detail ?? ""}`);
  console.log(`\n${results.length - failed.length}/${results.length} attacks blocked`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
