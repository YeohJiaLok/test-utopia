/**
 * Seeds a Supabase project with sample accounts and ~8 weeks of operational history.
 *   npm run db:seed          (reads .env.local; RESETS operational demo data)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SAMPLE_ACCOUNTS } from "./sample-accounts";
import { BRANCHES, SERVICE_TYPES, TECHNICIANS, generateSeed, type BranchCode, type ServiceCode } from "./seed-data";
import { SAMPLE_MEDIA_FILES } from "./sample-media";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const password = process.env.SEED_PASSWORD;

if (!url || !serviceKey) {
  console.error("✖ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}
if (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  console.error("✖ SEED_PASSWORD must be set in .env.local (8+ characters, letters and a number): the sample accounts' password");
  process.exit(1);
}

const db: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const ACCOUNT_BRANCH: Record<string, BranchCode> = { admin: "SA", manager: "SA", benny: "SA", ali: "SA", yusoff: "SA", john: "KL", bala: "PJ" };

function step(label: string) {
  console.log(`\n▸ ${label}`);
}

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data as NonNullable<T>;
}

async function insertChunked(table: string, rows: Record<string, unknown>[], size = 400) {
  for (let i = 0; i < rows.length; i += size) {
    await must(db.from(table).insert(rows.slice(i, i + size)), `insert ${table}`);
  }
  console.log(`  ${table.padEnd(18)} ${rows.length}`);
}

async function ensureUsers() {
  const existing = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    data.users.forEach((u) => u.email && existing.set(u.email.toLowerCase(), u.id));
    if (data.users.length < 1000) break;
  }

  const ids: Record<string, string> = {};
  for (const a of SAMPLE_ACCOUNTS) {
    const attrs = {
      email: a.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: a.fullName },
    };
    const found = existing.get(a.email);
    if (found) {
      const { error } = await db.auth.admin.updateUserById(found, { ...attrs, ban_duration: "none" }); // re-enable if deactivated
      if (error) throw error;
      ids[a.key] = found;
    } else {
      const { data, error } = await db.auth.admin.createUser(attrs);
      if (error) throw error;
      ids[a.key] = data.user.id;
    }
    console.log(`  ${a.role.padEnd(10)} ${a.email}`);
  }
  return ids;
}

async function wipe() {
  // Children first; most cascade from orders but be explicit for clarity.
  const tables: [string, string][] = [
    ["ai_runs", "id"], ["ai_insights", "id"], ["ai_flags", "id"], ["notifications", "id"], ["reviews", "id"],
    ["reschedules", "id"], ["order_events", "id"], ["order_attachments", "id"], ["job_completions", "order_id"],
    ["orders", "id"], ["customers", "id"], ["technicians", "id"],
  ];
  for (const [t, key] of tables) {
    await must(db.from(t).delete().not(key, "is", null), `wipe ${t}`);
  }
}

async function main() {
  console.log(`Seeding ${url}`);

  step("Sample job media → storage");
  for (const [path, svg] of Object.entries(SAMPLE_MEDIA_FILES)) {
    const { error } = await db.storage.from("job-media").upload(path, new Blob([svg], { type: "image/svg+xml" }), {
      upsert: true,
      contentType: "image/svg+xml",
    });
    if (error) throw new Error(`upload ${path}: ${error.message}`);
  }
  console.log(`  ${Object.keys(SAMPLE_MEDIA_FILES).length} files`);

  step("Reference data");
  await must(db.from("branches").upsert(BRANCHES.map((b) => ({ ...b })), { onConflict: "code" }), "branches");
  await must(db.from("service_types").upsert(SERVICE_TYPES.map((s) => ({ ...s, active: true })), { onConflict: "code" }), "service_types");
  const branches = await must(db.from("branches").select("id, code"), "read branches");
  const services = await must(db.from("service_types").select("id, code"), "read service types");
  const branchId = Object.fromEntries(branches.map((b) => [b.code, b.id])) as Record<BranchCode, number>;
  const serviceId = Object.fromEntries(services.map((s) => [s.code, s.id])) as Record<ServiceCode, number>;

  step("Reset operational data");
  await wipe();

  step("Sample accounts");
  const userIds = await ensureUsers();
  await must(
    db.from("profiles").upsert(
      SAMPLE_ACCOUNTS.map((a) => ({
        id: userIds[a.key],
        full_name: a.fullName,
        email: a.email,
        role: a.role,
        branch_id: branchId[ACCOUNT_BRANCH[a.key] ?? "SA"],
        phone: TECHNICIANS.find((t) => t.account === a.key)?.phone ?? null,
        active: true, // role + active are copied into the JWT claims by the profiles_sync_claims trigger
      })),
      { onConflict: "id" },
    ),
    "profiles",
  );

  const profileByTech = Object.fromEntries(
    TECHNICIANS.filter((t) => t.account).map((t) => [t.name, userIds[t.account!]!]),
  );
  const admin = SAMPLE_ACCOUNTS.find((a) => a.key === "admin")!;
  const manager = SAMPLE_ACCOUNTS.find((a) => a.key === "manager")!;

  step("Operational history");
  const data = generateSeed({
    branchId,
    serviceId,
    profileByTech,
    adminProfileId: userIds.admin!,
    managerProfileId: userIds.manager!,
    adminName: admin.fullName,
    managerName: manager.fullName,
  });

  await insertChunked("technicians", data.technicians);
  await insertChunked("customers", data.customers);
  await insertChunked("orders", data.orders);
  await insertChunked("job_completions", data.completions);
  await insertChunked("order_attachments", data.attachments);
  await insertChunked("reschedules", data.reschedules);
  await insertChunked("reviews", data.reviews);
  await insertChunked("order_events", data.events, 800);
  await insertChunked("notifications", data.notifications);

  const max = await must(db.rpc("sync_order_no_seq"), "sync_order_no_seq");
  console.log(`  order_no sequence → ${max}`);

  step("AI Supervisor — rule-based flags on completed jobs");
  const { buildSeedFlags } = await import("./seed-flags");
  const flags = buildSeedFlags(data);
  if (flags.length) await insertChunked("ai_flags", flags);

  console.log("\n✔ Seed complete. Sample accounts (password: SEED_PASSWORD from .env.local):");
  for (const a of SAMPLE_ACCOUNTS) console.log(`  ${a.title.padEnd(28)} ${a.email}`);
}

main().catch((e) => {
  console.error("\n✖ Seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
