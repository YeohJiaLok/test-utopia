/**
 * Deterministic demo-data generator (no I/O). Produces ~8 weeks of realistic operational
 * history relative to `now`, with a few deliberate anomalies for the AI supervisor and a
 * clearly overloaded technician (Bala) in the current week.
 */
import { TZDate } from "@date-fns/tz";
import { addDays, addHours, addMinutes, startOfDay, startOfWeek, format } from "date-fns";

export const TZ = "Asia/Kuala_Lumpur";

export const BRANCHES = [
  { code: "SA", name: "Shah Alam (HQ)", state: "Selangor" },
  { code: "KL", name: "Kuala Lumpur", state: "W.P. Kuala Lumpur" },
  { code: "PJ", name: "Petaling Jaya", state: "Selangor" },
  { code: "JB", name: "Johor Bahru", state: "Johor" },
  { code: "PG", name: "Penang", state: "Pulau Pinang" },
] as const;

export const SERVICE_TYPES = [
  { code: "CLEAN", name: "Aircond cleaning", base_price: 120, est_minutes: 60 },
  { code: "CHEM", name: "Chemical wash", base_price: 250, est_minutes: 120 },
  { code: "GAS", name: "Gas refill", base_price: 180, est_minutes: 60 },
  { code: "REPAIR", name: "Repair", base_price: 300, est_minutes: 120 },
  { code: "INSTALL", name: "Installation", base_price: 450, est_minutes: 180 },
  { code: "INSPECT", name: "Inspection & diagnosis", base_price: 80, est_minutes: 45 },
  { code: "DISMANTLE", name: "Dismantle & relocate", base_price: 200, est_minutes: 120 },
] as const;

export type BranchCode = (typeof BRANCHES)[number]["code"];
export type ServiceCode = (typeof SERVICE_TYPES)[number]["code"];

/** Technicians; `account` links to a demo login in src/lib/demo.ts. */
export const TECHNICIANS: { name: string; phone: string; branch: BranchCode; team: string; skills: string[]; account?: string }[] = [
  { name: "Ali Hassan", phone: "012-345 6789", branch: "SA", team: "SA-T01", skills: ["Cleaning", "Gas", "Repair"], account: "ali" },
  { name: "Yusoff Ismail", phone: "013-228 9013", branch: "SA", team: "SA-T02", skills: ["Installation", "Repair"], account: "yusoff" },
  { name: "Farid Zulkifli", phone: "017-661 2450", branch: "SA", team: "SA-T03", skills: ["Cleaning", "Chemical wash"] },
  { name: "John Lim", phone: "016-778 1204", branch: "KL", team: "KL-T01", skills: ["Repair", "Inspection"], account: "john" },
  { name: "Tan Wei Jie", phone: "012-909 3321", branch: "KL", team: "KL-T02", skills: ["Cleaning", "Gas"] },
  { name: "Hafiz Rahman", phone: "019-455 7810", branch: "KL", team: "KL-T03", skills: ["Installation", "Dismantle"] },
  { name: "Bala Krishnan", phone: "014-332 5567", branch: "PJ", team: "PJ-T01", skills: ["Cleaning", "Chemical wash", "Gas"], account: "bala" },
  { name: "Kumar Selvam", phone: "011-2345 6620", branch: "PJ", team: "PJ-T02", skills: ["Repair", "Inspection"] },
  { name: "Azman Yusof", phone: "018-220 4471", branch: "PJ", team: "PJ-T03", skills: ["Installation"] },
  { name: "Rizal Ahmad", phone: "017-889 0032", branch: "JB", team: "JB-T01", skills: ["Cleaning", "Repair"] },
  { name: "Chong Kah Wai", phone: "012-776 5409", branch: "JB", team: "JB-T02", skills: ["Gas", "Chemical wash"] },
  { name: "Siva Raman", phone: "016-554 2208", branch: "JB", team: "JB-T03", skills: ["Installation", "Repair"] },
  { name: "Arif Hakim", phone: "019-668 3315", branch: "PG", team: "PG-T01", skills: ["Cleaning", "Repair"] },
  { name: "Lim Boon Huat", phone: "012-441 7756", branch: "PG", team: "PG-T02", skills: ["Gas", "Installation"] },
];

const FIRST = ["Ahmad", "Siti", "Tan", "Rajesh", "Nurul", "Lee", "Muthu", "Farah", "Wong", "Aisyah", "Kumar", "Chen", "Hafizah", "Lim", "Priya", "Zainal", "Ong", "Mei Ling", "Hidayah", "Ravi", "Goh", "Amirul", "Kavitha", "Teoh"];
const LAST = ["bin Abdullah", "Nurhaliza", "Mei Ling", "Kumar", "Aina", "Chong Wei", "Samy", "Hanim", "Kok Leong", "Sofea", "Rajan", "Xiu Ying", "Ismail", "Siew Ling", "Devi", "Arifin", "Boon Keat", "Tan", "Rosli", "Chandran", "Wei Ming", "Hakim", "Subramaniam", "Hui Min"];

const STREETS: Record<BranchCode, string[]> = {
  SA: ["Jalan Sejuk 7/2, Seksyen 7, 40000 Shah Alam", "Jalan Kristal 13/1, Seksyen 13, 40100 Shah Alam", "Jalan Setia Prima, Setia Alam, 40170 Shah Alam", "Jalan Kota Kemuning 31/1, 40460 Shah Alam"],
  KL: ["Jalan Ampang, 50450 Kuala Lumpur", "Jalan Desa Bakti, Taman Desa, 58100 Kuala Lumpur", "Jalan Kuching, Segambut, 51200 Kuala Lumpur", "Jalan Cheras, Taman Connaught, 56000 Kuala Lumpur"],
  PJ: ["Jalan SS2/24, SS2, 47300 Petaling Jaya", "Jalan Damansara Utama, 47400 Petaling Jaya", "Jalan PJU 1/41, Ara Damansara, 47301 Petaling Jaya", "Jalan 17/27, Seksyen 17, 46400 Petaling Jaya"],
  JB: ["Jalan Molek 1/29, Taman Molek, 81100 Johor Bahru", "Jalan Austin Heights 3, Mount Austin, 81100 Johor Bahru", "Jalan Sutera Tanjung, Taman Sutera, 81200 Johor Bahru"],
  PG: ["Jalan Sultan Azlan Shah, Bayan Lepas, 11900 Penang", "Jalan Jelutong, 11600 George Town", "Lebuh Pantai, 10300 George Town"],
};

const PROBLEMS: Record<ServiceCode, string[]> = {
  CLEAN: ["Aircond not cold enough, routine service due", "Bad smell when aircond turned on", "Water dripping from indoor unit", "Yearly servicing for 3 units"],
  CHEM: ["Very weak airflow, heavy dust build-up", "Indoor unit coil looks black and mouldy", "Unit not serviced for over 2 years"],
  GAS: ["Blowing warm air, suspect gas leak", "Outdoor unit icing up", "Cooling slow after recent servicing"],
  REPAIR: ["Aircond won't turn on, remote not responding", "Loud rattling noise from outdoor unit", "Compressor trips the breaker", "Error code E5 blinking on display"],
  INSTALL: ["New 1.5HP inverter unit installation, master bedroom", "Install 2 new units for renovated office", "Replace old non-inverter with new 1HP inverter"],
  INSPECT: ["Strange burning smell, need inspection", "Electricity bill spiked, check efficiency", "Pre-purchase inspection for property"],
  DISMANTLE: ["Relocate unit from living room to bedroom", "Dismantle 2 units before moving house"],
};

const WORK: Record<ServiceCode, string[]> = {
  CLEAN: ["General cleaning of indoor & outdoor unit, filters washed, drain pipe flushed", "Cleaned filters and blower, flushed drain, tested cooling at 16°C"],
  CHEM: ["Full chemical wash of coil and blower, drain pipe flushed, tested 14°C outlet temp", "Dismantled indoor unit, chemical wash, sanitised blower wheel"],
  GAS: ["Leak test on flare joints, re-flared joint, topped up R32 gas to 120 psi", "Topped up R410A gas, pressure stabilised, cooling restored"],
  REPAIR: ["Replaced faulty capacitor, tested compressor amps", "Replaced PCB fan motor relay, unit running normally", "Tightened loose outdoor fan blade and mounting bolts"],
  INSTALL: ["Installed 1.5HP inverter unit, 10ft piping, vacuum & leak tested", "Installed new unit with bracket, trunking and drain line"],
  INSPECT: ["Full inspection, found worn capacitor and clogged filter — quotation given", "Checked wiring and insulation, efficiency test done"],
  DISMANTLE: ["Dismantled, pumped down gas, relocated and re-installed with new piping", "Pumped down and dismantled 2 units, capped piping"],
};

const EXTRA_REASONS = ["Additional 5ft copper piping", "Replaced capacitor (parts)", "Extra gas top-up", "Bracket & trunking", "Drain pump replacement", "After-hours callout"];
const RESCHEDULE_REASONS = ["Customer not home", "Parts unavailable", "Customer requested new date", "Heavy rain — outdoor unit unsafe", "Previous job overran"];

/* ------------------------------------------------------------------ PRNG -- */
export function rng(seed = 20261103) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)]!,
    chance: (p: number) => next() < p,
    uuid: () => {
      const h = Array.from({ length: 32 }, () => Math.floor(next() * 16).toString(16));
      h[12] = "4";
      h[16] = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
      const s = h.join("");
      return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
    },
  };
}

/* ---------------------------------------------------------------- output -- */
export interface SeedRefs {
  branchId: Record<BranchCode, number>;
  serviceId: Record<ServiceCode, number>;
  /** technician name → profile id for demo accounts */
  profileByTech: Record<string, string>;
  adminProfileId: string;
  managerProfileId: string;
  adminName: string;
  managerName: string;
}

export interface SeedOutput {
  technicians: Record<string, unknown>[];
  customers: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  completions: Record<string, unknown>[];
  attachments: Record<string, unknown>[];
  events: Record<string, unknown>[];
  reschedules: Record<string, unknown>[];
  reviews: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
}

export const SAMPLE_MEDIA = [
  "samples/indoor-before.svg",
  "samples/indoor-after.svg",
  "samples/filter.svg",
  "samples/gauge.svg",
  "samples/outdoor-unit.svg",
  "samples/drain.svg",
];

const SERVICE_WEIGHTS: [ServiceCode, number][] = [
  ["CLEAN", 34], ["CHEM", 16], ["GAS", 14], ["REPAIR", 16], ["INSTALL", 8], ["INSPECT", 8], ["DISMANTLE", 4],
];

function weighted<T>(r: ReturnType<typeof rng>, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = r.next() * total;
  for (const [item, w] of items) {
    x -= w;
    if (x <= 0) return item;
  }
  return items[items.length - 1]![0];
}

function mytLabel(d: Date) {
  return format(new TZDate(d, TZ), "dd MMM yyyy, hh:mm a");
}

function waNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("60") ? d : d.startsWith("0") ? `6${d}` : d;
}

export function generateSeed(refs: SeedRefs, now: Date = new Date()): SeedOutput {
  const r = rng();
  const out: SeedOutput = {
    technicians: [], customers: [], orders: [], completions: [], attachments: [],
    events: [], reschedules: [], reviews: [], notifications: [],
  };

  // Technicians
  const techs = TECHNICIANS.map((t) => {
    const id = r.uuid();
    const row = {
      id,
      profile_id: refs.profileByTech[t.name] ?? null,
      name: t.name,
      phone: t.phone,
      branch_id: refs.branchId[t.branch],
      team_code: t.team,
      skills: t.skills,
      active: true,
    };
    out.technicians.push(row);
    return { ...t, id, profile_id: row.profile_id };
  });
  const techsByBranch = (b: BranchCode) => techs.filter((t) => t.branch === b);

  // Customers
  const customers = Array.from({ length: 140 }, () => {
    const branch = weighted<BranchCode>(r, [["SA", 30], ["KL", 24], ["PJ", 24], ["JB", 12], ["PG", 10]]);
    const name = `${r.pick(FIRST)} ${r.pick(LAST)}`;
    const prefix = r.pick(["012", "013", "014", "016", "017", "018", "019"]);
    const row = {
      id: r.uuid(),
      name,
      phone: `${prefix}-${r.int(200, 999)} ${r.int(1000, 9999)}`,
      address: `No. ${r.int(1, 88)}, ${r.pick(STREETS[branch])}`,
      branch_id: refs.branchId[branch],
      branch,
    };
    out.customers.push({ id: row.id, name: row.name, phone: row.phone, address: row.address, branch_id: row.branch_id });
    return row;
  });

  const nowMyt = new TZDate(now, TZ);
  const today = startOfDay(nowMyt);
  const thisWeek = startOfWeek(nowMyt, { weekStartsOn: 1 });
  const firstDay = addDays(thisWeek, -49);
  const lastDay = addDays(today, 3);

  let seq = 1000;
  const anomalies = { overQuote: 0, noMedia: 0, payMismatch: 0 };

  const event = (orderId: string, at: Date, action: string, from: string | null, to: string | null, actor: { id: string | null; name: string; role: string | null }, payload: Record<string, unknown> = {}) => {
    out.events.push({ order_id: orderId, actor_id: actor.id, actor_name: actor.name, actor_role: actor.role, action, from_status: from, to_status: to, payload, created_at: at.toISOString() });
  };
  const admin = { id: refs.adminProfileId, name: refs.adminName, role: "admin" };
  const manager = { id: refs.managerProfileId, name: refs.managerName, role: "manager" };

  for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) {
    const dow = day.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const inThisWeek = day >= thisWeek;
    let volume = isWeekend ? r.int(4, 6) : r.int(7, 10);
    if (day > today) volume = r.int(3, 5);

    // Bala is visibly overloaded this week (extra PJ cleaning jobs).
    const balaBoost = inThisWeek && day <= today ? 4 : 0;

    for (let i = 0; i < volume + balaBoost; i++) {
      const forceBala = i >= volume;
      const customer = forceBala ? r.pick(customers.filter((c) => c.branch === "PJ")) : r.pick(customers);
      const branch = customer.branch;
      const service: ServiceCode = forceBala ? r.pick(["CLEAN", "CHEM", "GAS"] as const) : weighted(r, SERVICE_WEIGHTS);
      const st = SERVICE_TYPES.find((s) => s.code === service)!;
      const tech = forceBala ? techs.find((t) => t.name === "Bala Krishnan")! : r.pick(techsByBranch(branch));
      const quoted = Math.max(60, Math.round((st.base_price * (0.85 + r.next() * 0.4)) / 10) * 10);

      // Booked 1–3 days ahead during office hours (never in the future relative to now).
      let createdAt: Date = addMinutes(addHours(addDays(day, -r.int(1, 3)), r.int(8, 17)), r.int(0, 59));
      if (createdAt > now) createdAt = new Date(now.getTime() - r.int(30, 600) * 60_000);
      const scheduledAt = addMinutes(addHours(day, r.int(9, 16)), r.pick([0, 30]));
      const orderId = r.uuid();
      const orderNo = `SJK-${format(new TZDate(createdAt, TZ), "yyMM")}-${String(++seq).padStart(5, "0")}`;

      // Lifecycle based on schedule vs now
      const isFuture = scheduledAt > nowMyt;
      const isToday = scheduledAt >= today && scheduledAt < addDays(today, 1);
      let status: string;
      if (isFuture) {
        status = !isToday && r.chance(0.4) ? "new" : "assigned";
      } else {
        const ageDays = (now.getTime() - scheduledAt.getTime()) / 86_400_000;
        if (ageDays < 0.4 && r.chance(0.3)) status = "in_progress";
        else if (ageDays < 1.5) status = "job_done";
        else if (ageDays < 3.5) status = r.chance(0.55) ? "reviewed" : "job_done";
        else status = r.chance(0.9) ? "closed" : "reviewed";
      }

      const assigned = status !== "new";
      let assignedAt = assigned ? addMinutes(createdAt, r.int(10, 180)) : null;
      if (assignedAt && assignedAt > now) assignedAt = new Date(Math.max(createdAt.getTime(), now.getTime() - 60_000));

      // Some jobs were postponed (1–2 times) before landing on the final schedule.
      let rescheduleCount = 0;
      if (assigned && r.chance(0.09)) {
        rescheduleCount = r.chance(0.2) ? 2 : 1;
        let newer = scheduledAt;
        const chain: Record<string, unknown>[] = [];
        for (let k = 0; k < rescheduleCount; k++) {
          const older = addHours(newer, -24 * r.int(1, 2));
          const at = addMinutes(older, -r.int(60, 600));
          chain.unshift({ order_id: orderId, technician_id: tech.id, old_scheduled_at: older.toISOString(), new_scheduled_at: newer.toISOString(), reason: r.pick(RESCHEDULE_REASONS), requested_by: tech.profile_id ?? refs.adminProfileId, created_at: at.toISOString() });
          newer = older;
        }
        out.reschedules.push(...chain);
        const firstAt = new Date(chain[0]!.created_at as string);
        if (assignedAt && assignedAt > firstAt) {
          createdAt = addHours(firstAt, -3);
          assignedAt = addHours(firstAt, -1);
        }
      }

      // Each lifecycle timestamp follows the previous one and never lands in the future.
      const past = (d: Date, prev: Date) => (d <= now ? d : new Date(Math.max(prev.getTime(), now.getTime() - r.int(1, 20) * 60_000)));
      const done = ["job_done", "reviewed", "closed"].includes(status);
      const startedAt =
        status === "in_progress" || done ? past(addMinutes(scheduledAt, r.int(-15, 30)), assignedAt ?? createdAt) : null;
      const completedAt = done ? past(addMinutes(startedAt!, st.est_minutes + r.int(-15, 75)), startedAt!) : null;
      const reviewedAt = ["reviewed", "closed"].includes(status) ? past(addHours(completedAt!, r.int(2, 30)), completedAt!) : null;
      const closedAt = status === "closed" ? past(addHours(reviewedAt!, r.int(1, 24)), reviewedAt!) : null;

      out.orders.push({
        id: orderId,
        order_no: orderNo,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_address: customer.address,
        branch_id: refs.branchId[branch],
        service_type_id: refs.serviceId[service],
        problem_description: r.pick(PROBLEMS[service]),
        quoted_price: quoted,
        assigned_technician_id: assigned ? tech.id : null,
        admin_notes: r.chance(0.25) ? r.pick(["Call 30 min before arrival", "Condo — register at guardhouse", "Customer prefers morning slot", "Dog in compound", "Parking at basement B2"]) : null,
        status,
        scheduled_at: scheduledAt.toISOString(),
        reschedule_count: rescheduleCount,
        source: r.chance(0.12) ? "ai_document" : "manual",
        created_by: refs.adminProfileId,
        created_at: createdAt.toISOString(),
        updated_at: (closedAt ?? reviewedAt ?? completedAt ?? startedAt ?? assignedAt ?? createdAt).toISOString(),
        assigned_at: assignedAt?.toISOString() ?? null,
        started_at: startedAt?.toISOString() ?? null,
        completed_at: completedAt?.toISOString() ?? null,
        reviewed_at: reviewedAt?.toISOString() ?? null,
        closed_at: closedAt?.toISOString() ?? null,
      });

      const techActor = { id: tech.profile_id, name: tech.name, role: "technician" };
      event(orderId, createdAt, "order_created", null, "new", admin, { quoted_price: quoted, source: "manual" });
      if (assignedAt) event(orderId, assignedAt, "technician_assigned", "new", "assigned", admin, { technician_id: tech.id, technician_name: tech.name });
      for (const rs of out.reschedules.filter((x) => x.order_id === orderId)) {
        event(orderId, new Date(rs.created_at as string), "job_rescheduled", "assigned", "assigned", techActor, { from: rs.old_scheduled_at, to: rs.new_scheduled_at, reason: rs.reason });
      }
      if (startedAt) event(orderId, startedAt, "job_started", "assigned", "in_progress", techActor);

      if (done && completedAt) {
        // Deliberate anomalies on recent, un-reviewed jobs (for the AI supervisor demo)
        const recent = status === "job_done";
        let extra = r.chance(0.3) ? r.pick([20, 30, 50, 80, 100, 150]) : 0;
        let remarks: string | null = extra ? r.pick(EXTRA_REASONS) : r.chance(0.3) ? "Customer satisfied, advised servicing every 6 months" : null;
        let mediaCount = r.int(2, 4);
        if (recent && anomalies.overQuote < 3 && r.chance(0.35)) {
          extra = Math.round(quoted * r.pick([0.9, 1.2, 1.6]));
          remarks = anomalies.overQuote === 0 ? null : "Customer agreed to compressor part replacement";
          anomalies.overQuote++;
        } else if (recent && anomalies.noMedia < 3 && r.chance(0.3)) {
          mediaCount = 0;
          anomalies.noMedia++;
        }
        const final = quoted + extra;
        const method = r.pick(["cash", "ewallet", "bank_transfer", "card", "cash", "ewallet"] as const);
        let payment: number | null = r.chance(0.9) ? final : null;
        if (recent && payment !== null && anomalies.payMismatch < 2 && r.chance(0.25)) {
          payment = Math.max(0, final - r.pick([50, 100]));
          anomalies.payMismatch++;
        }

        out.completions.push({
          order_id: orderId,
          technician_id: tech.id,
          work_done: r.pick(WORK[service]),
          quoted_price: quoted,
          extra_charges: extra,
          remarks,
          payment_amount: payment,
          payment_method: payment === null ? "unpaid" : method,
          receipt_path: null,
          completed_at: completedAt.toISOString(),
          created_at: completedAt.toISOString(),
        });

        const media = [...SAMPLE_MEDIA].sort(() => r.next() - 0.5).slice(0, mediaCount);
        media.forEach((path, idx) =>
          out.attachments.push({
            order_id: orderId,
            kind: "photo",
            storage_path: path,
            file_name: path.split("/")[1],
            mime_type: "image/svg+xml",
            size_bytes: r.int(180_000, 2_400_000),
            uploaded_by: tech.profile_id,
            created_at: addMinutes(startedAt!, 10 + idx * 7).toISOString(),
          }),
        );

        event(orderId, completedAt, "job_completed", "in_progress", "job_done", techActor, {
          final_amount: final, extra_charges: extra, attachments: mediaCount, payment_amount: payment, payment_method: payment === null ? "unpaid" : method,
        });

        // Module 3 artefacts for recent completions
        if (completedAt.getTime() > now.getTime() - 3 * 86_400_000) {
          const msg = `Hi ${customer.name},\nJob ${orderNo} has been completed by Technician ${tech.name} at ${mytLabel(completedAt)}.\nPlease check and leave feedback.\nThank you!`;
          out.notifications.push({
            order_id: orderId, channel: "whatsapp", audience: "customer", recipient_phone: customer.phone,
            template: "job_done_customer_feedback", title: `Feedback request · ${customer.name}`, message: msg,
            deep_link: `https://wa.me/${waNumber(customer.phone)}?text=${encodeURIComponent(msg)}`,
            status: r.chance(0.7) ? "opened" : "pending", created_at: completedAt.toISOString(),
          });
          if (status === "job_done") {
            out.notifications.push({
              order_id: orderId, channel: "in_app", audience: "manager", recipient_profile_id: refs.managerProfileId,
              template: "job_done_review", title: `Job ${orderNo} completed`,
              message: `${tech.name} completed ${st.name} for ${customer.name} · Final RM ${final.toFixed(2)}`,
              status: completedAt.getTime() > now.getTime() - 86_400_000 ? "pending" : "read", created_at: completedAt.toISOString(),
            });
          }
        }

        if (reviewedAt) {
          const rating = r.chance(0.75) ? 5 : r.chance(0.8) ? 4 : 3;
          out.reviews.push({ order_id: orderId, manager_id: refs.managerProfileId, rating, decision: "approved", notes: rating < 4 ? "Remind team to upload clearer photos" : null, created_at: reviewedAt.toISOString() });
          event(orderId, reviewedAt, "job_reviewed", "job_done", "reviewed", manager, { rating });
        }
        if (closedAt) event(orderId, closedAt, "job_closed", "reviewed", "closed", manager);
      }
    }
  }

  return out;
}
