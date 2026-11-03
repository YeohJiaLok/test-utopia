import { describe, expect, it } from "vitest";
import { checkUserChange, createUserSchema, parseSkills, passwordStrength, resetPasswordSchema, safeNext, updateUserSchema } from "@/lib/users";

const ADMIN = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";

const base = {
  fullName: "Siti Aminah",
  email: "  Siti@Sejuk.com ",
  role: "manager" as const,
  branchId: "1",
  phone: "",
  teamCode: "",
  skills: "",
  technicianId: "",
  password: "Secure2026",
  confirmPassword: "Secure2026",
};

describe("create user validation", () => {
  it("accepts a valid manager and normalises the email", () => {
    const r = createUserSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data?.email).toBe("siti@sejuk.com");
  });

  it("enforces password rules and matching confirmation", () => {
    expect(createUserSchema.safeParse({ ...base, password: "short1", confirmPassword: "short1" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, password: "lettersonly", confirmPassword: "lettersonly" }).success).toBe(false);
    const mismatch = createUserSchema.safeParse({ ...base, confirmPassword: "Secure2027" });
    expect(mismatch.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("requires a phone and team code for a new technician, not when linking a roster entry", () => {
    const tech = { ...base, role: "technician" as const };
    const paths = (v: object) => createUserSchema.safeParse(v).error?.issues.map((i) => i.path[0]) ?? [];
    expect(paths(tech)).toEqual(expect.arrayContaining(["phone", "teamCode"]));
    expect(paths({ ...tech, phone: "012-345 6789", teamCode: "SA-09" })).toEqual([]);
    expect(paths({ ...tech, phone: "012-345 6789", technicianId: OTHER })).toEqual([]);
  });

  it("requires a branch", () => {
    expect(createUserSchema.safeParse({ ...base, branchId: "" }).success).toBe(false);
  });
});

describe("edit + reset validation", () => {
  it("validates an edit without any password", () => {
    const profile = { fullName: base.fullName, role: base.role, branchId: base.branchId, phone: "", teamCode: "", skills: "" };
    expect(updateUserSchema.safeParse({ ...profile, id: OTHER, active: false }).success).toBe(true);
  });

  it("resets only with a valid, confirmed password", () => {
    expect(resetPasswordSchema.safeParse({ id: OTHER, password: "NewPass99", confirmPassword: "NewPass99" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ id: OTHER, password: "NewPass99", confirmPassword: "nope" }).success).toBe(false);
  });
});

describe("user change guardrails", () => {
  const admin = { role: "admin" as const, active: true };

  it("blocks removing your own admin role or deactivating yourself", () => {
    const self = { actorId: ADMIN, targetId: ADMIN, current: admin, activeAdmins: 3, openJobs: 0 };
    expect(checkUserChange({ ...self, next: { role: "manager", active: true } })).toMatch(/own admin role/);
    expect(checkUserChange({ ...self, next: { role: "admin", active: false } })).toMatch(/deactivate your own/);
    expect(checkUserChange({ ...self, next: admin })).toBeNull();
  });

  it("keeps at least one active admin", () => {
    const last = { actorId: ADMIN, targetId: OTHER, current: admin, activeAdmins: 1, openJobs: 0 };
    expect(checkUserChange({ ...last, next: { role: "manager", active: true } })).toMatch(/last active admin/);
    expect(checkUserChange({ ...last, activeAdmins: 2, next: { role: "manager", active: true } })).toBeNull();
  });

  it("blocks moving or deactivating a technician with open jobs", () => {
    const tech = { actorId: ADMIN, targetId: OTHER, current: { role: "technician" as const, active: true }, activeAdmins: 1 };
    expect(checkUserChange({ ...tech, openJobs: 2, next: { role: "technician", active: false } })).toMatch(/2 open jobs/);
    expect(checkUserChange({ ...tech, openJobs: 1, next: { role: "manager", active: true } })).toMatch(/1 open job\. Reassign it/);
    expect(checkUserChange({ ...tech, openJobs: 0, next: { role: "manager", active: false } })).toBeNull();
  });
});

describe("sign-in routing", () => {
  it("follows `next` only inside the user's own portal", () => {
    expect(safeNext("/tech/jobs/abc", "/tech")).toBe("/tech/jobs/abc");
    expect(safeNext("/admin/users", "/tech")).toBe("/tech");
    expect(safeNext("/technician-evil", "/tech")).toBe("/tech");
    expect(safeNext("//evil.com/tech", "/tech")).toBe("/tech");
    expect(safeNext(undefined, "/manager")).toBe("/manager");
  });
});

describe("helpers", () => {
  it("parses skills into a clean, unique list", () => {
    expect(parseSkills(" Installation, Servicing ,, installation, Servicing")).toEqual(["Installation", "Servicing", "installation"]);
  });

  it("scores password strength", () => {
    expect(passwordStrength("abc").score).toBe(0);
    expect(passwordStrength("Abcdefgh1!").label).toBe("Good");
  });
});
