import { describe, expect, it } from "vitest";
import { availableActions, canPerform, ORDER_STATUSES, statusIndex } from "@/lib/workflow";

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
      ["complete", "reschedule", "start"].sort(),
    );
  });
});
