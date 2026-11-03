"use client";

import { useId, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Loader2, Lock, UserCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/shared/form-field";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TechnicianWithLoad } from "@/lib/data/reference";
import { assignTechnicianAction, closeJobAction, rescheduleOrderAction } from "@/app/(app)/admin/actions";
import { fromMytInputValue, toMytInputValue } from "./datetime";
import { rescheduleSchema, type RescheduleValues } from "./order-schema";
import { TechnicianList, recommendTechnician } from "./technician-picker";

// ------------------------------------------------------------------ assign --

export function AssignTechnicianDialog({
  orderId,
  orderNo,
  currentTechnicianId,
  branchId,
  technicians,
  mode,
  triggerClassName,
}: {
  orderId: string;
  orderNo: string;
  currentTechnicianId: string | null;
  branchId: number | null;
  technicians: TechnicianWithLoad[];
  mode: "assign" | "reassign";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const recommended = recommendTechnician(
    technicians.filter((t) => t.id !== currentTechnicianId),
    branchId,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const choice = selected ?? recommended?.id ?? null;
  const unchanged = choice === currentTechnicianId;

  function confirm() {
    if (!choice || unchanged) return;
    startTransition(async () => {
      const res = await assignTechnicianAction(orderId, choice);
      if (res.ok) {
        toast.success(`${orderNo} ${mode === "assign" ? "assigned" : "reassigned"} to ${res.data.technicianName}`, {
          description: "A WhatsApp job card has been queued for the technician.",
        });
        setOpen(false);
        setSelected(null);
      } else {
        toast.error("Assignment failed", { description: res.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={mode === "assign" ? "default" : "outline"} size="sm" className={cn("h-8", triggerClassName)} />}>
        {mode === "assign" ? <UserCheck /> : <UserCog />}
        {mode === "assign" ? "Assign technician" : "Reassign"}
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4">
          <DialogTitle>{mode === "assign" ? "Assign technician" : "Reassign technician"}</DialogTitle>
          <DialogDescription>
            {orderNo} · technicians are sorted by current open-job load; the least-loaded one in this branch is recommended.
          </DialogDescription>
        </DialogHeader>
        <TechnicianList technicians={technicians} value={choice} onSelect={(id) => setSelected(id)} recommendedId={recommended?.id} />
        <DialogFooter className="m-0 rounded-b-xl">
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={confirm} disabled={!choice || unchanged || pending}>
            {pending ? <Loader2 className="animate-spin" /> : <UserCheck />}
            {unchanged ? "Already assigned" : "Confirm assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------- reschedule --

export function RescheduleDialog({
  orderId,
  orderNo,
  scheduledAt,
  triggerClassName,
}: {
  orderId: string;
  orderNo: string;
  scheduledAt: string | null;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ids = useId();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RescheduleValues>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: { scheduledAt: toMytInputValue(scheduledAt), reason: "" },
  });

  const onSubmit = handleSubmit(async (v) => {
    const res = await rescheduleOrderAction(orderId, v);
    if (!res.ok) {
      for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
        if (name === "scheduledAt" || name === "reason") setError(name, { message });
      }
      toast.error("Couldn't reschedule", { description: res.error });
      return;
    }
    const iso = fromMytInputValue(v.scheduledAt);
    toast.success(`${orderNo} rescheduled`, { description: iso ? `New slot ${formatDateTime(iso)}` : undefined });
    setOpen(false);
    reset({ scheduledAt: v.scheduledAt, reason: "" });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className={cn("h-8", triggerClassName)} />}>
        <CalendarClock /> Reschedule
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Reschedule {orderNo}</DialogTitle>
            <DialogDescription>
              Current slot: <span className="tabular">{scheduledAt ? formatDateTime(scheduledAt) : "not scheduled"}</span>. Each
              reschedule is logged and counts toward the technician KPI.
            </DialogDescription>
          </DialogHeader>
          <FormField label="New date & time (MYT)" htmlFor={`${ids}-at`} required error={errors.scheduledAt?.message}>
            <Input id={`${ids}-at`} type="datetime-local" step={900} className="h-9 tabular" aria-invalid={!!errors.scheduledAt} {...register("scheduledAt")} />
          </FormField>
          <FormField label="Reason" htmlFor={`${ids}-reason`} required error={errors.reason?.message} hint="Shared in the audit trail.">
            <Textarea
              id={`${ids}-reason`}
              rows={3}
              placeholder="e.g. Customer requested a later slot — not home until 3 PM"
              aria-invalid={!!errors.reason}
              {...register("reason")}
            />
          </FormField>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : <CalendarClock />}
              Save new slot
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------- close --

export function CloseJobButton({ orderId, orderNo, triggerClassName }: { orderId: string; orderNo: string; triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await closeJobAction(orderId);
      if (res.ok) {
        toast.success(`${orderNo} closed`, { description: "The order is finalised and archived." });
        setOpen(false);
      } else {
        toast.error("Couldn't close the order", { description: res.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className={cn("h-8", triggerClassName)} />}>
        <Lock /> Close order
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close {orderNo}?</DialogTitle>
          <DialogDescription>
            The job has been reviewed and approved. Closing finalises the order — it can no longer be reassigned or rescheduled.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={confirm} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Lock />}
            Close order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
