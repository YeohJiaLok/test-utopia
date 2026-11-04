import { describe, expect, it } from "vitest";
import { ALL_STATUSES, availableActions, canPerform, ORDER_STATUSES, statusIndex, TRANSITIONS } from "@/lib/workflow";

describe("workflow state machine (UI mirror of the DB rules)", () => {
  it("orders statuses along the lifecycle", () => {
    expect(ORDER_STATUSES).toEqual(["new", "assigned", "in_progress", "job_done", "reviewed", "closed"]);
    expect(statusIndex("job_done")).toBe(3);
  });

  it("only admins assign technicians", () => {
    expect(canPerform("assign", { status: "new", role: "admin", isAssignedTechnician: false })).toBe(true);
    expect(canPerform("assign", { status: "new", role: "manager", isAssignedTechnician: false })).toBe(false);
    expect(canPerform("assign", { status: "new", role: "technician", isAssignedTechnician: true })).toBe(false);
  });

  it("only the assigned technician completes a job", () => {
    expect(canPerform("complete", { status: "in_progress", role: "technician", isAssignedTechnician: true })).toBe(true);
    expect(canPerform("complete", { status: "in_progress", role: "technician", isAssignedTechnician: false })).toBe(false);
    expect(canPerform("complete", { status: "in_progress", role: "admin", isAssignedTechnician: false })).toBe(false);
  });

  it("managers review only Job Done orders", () => {
    expect(canPerform("review", { status: "job_done", role: "manager", isAssignedTechnician: false })).toBe(true);
    expect(canPerform("review", { status: "in_progress", role: "manager", isAssignedTechnician: false })).toBe(false);
    expect(canPerform("review", { status: "job_done", role: "admin", isAssignedTechnician: false })).toBe(false);
  });

  it("closed orders allow no further actions", () => {
    for (const role of ["admin", "manager", "technician"] as const) {
      expect(availableActions({ status: "closed", role, isAssignedTechnician: true })).toEqual([]);
    }
  });

  it("lists technician actions for an assigned job", () => {
    expect(availableActions({ status: "assigned", role: "technician", isAssignedTechnician: true }).sort()).toEqual(
      ["reschedule", "start"].sort(),
    );
  });

  it("only admins cancel, and only before the work is done", () => {
    for (const status of ["new", "assigned", "in_progress"] as const) {
      expect(canPerform("cancel", { status, role: "admin", isAssignedTechnician: false })).toBe(true);
      expect(canPerform("cancel", { status, role: "manager", isAssignedTechnician: false })).toBe(false);
      expect(canPerform("cancel", { status, role: "technician", isAssignedTechnician: true })).toBe(false);
    }
    for (const status of ["job_done", "reviewed", "closed", "cancelled"] as const) {
      expect(canPerform("cancel", { status, role: "admin", isAssignedTechnician: false })).toBe(false);
    }
  });

  it("cancelled orders allow no further actions and sit outside the pipeline", () => {
    for (const role of ["admin", "manager", "technician"] as const) {
      expect(availableActions({ status: "cancelled", role, isAssignedTechnician: true })).toEqual([]);
    }
    expect(ORDER_STATUSES).not.toContain("cancelled");
  });

  it("requires the job to be started before it can be completed", () => {
    expect(canPerform("complete", { status: "assigned", role: "technician", isAssignedTechnician: true })).toBe(false);
    expect(canPerform("complete", { status: "in_progress", role: "technician", isAssignedTechnician: true })).toBe(true);
    expect(canPerform("complete", { status: "in_progress", role: "technician", isAssignedTechnician: false })).toBe(false);
  });

  it("sends a reviewed job back as Rework, not In Progress", () => {
    expect(TRANSITIONS.find((t) => t.action === "rework")?.to).toBe("rework");
    expect(canPerform("rework", { status: "job_done", role: "manager", isAssignedTechnician: false })).toBe(true);
    expect(canPerform("rework", { status: "job_done", role: "technician", isAssignedTechnician: true })).toBe(false);
    expect(ALL_STATUSES).toContain("rework");
    expect(ORDER_STATUSES).not.toContain("rework");
    expect(statusIndex("rework")).toBe(statusIndex("in_progress"));
  });

  it("lets only the assigned technician resubmit a Rework job", () => {
    expect(availableActions({ status: "rework", role: "technician", isAssignedTechnician: true })).toEqual(["complete"]);
    expect(canPerform("complete", { status: "rework", role: "technician", isAssignedTechnician: false })).toBe(false);
    expect(canPerform("complete", { status: "rework", role: "admin", isAssignedTechnician: false })).toBe(false);
    expect(availableActions({ status: "rework", role: "manager", isAssignedTechnician: false })).toEqual([]);
  });
});
