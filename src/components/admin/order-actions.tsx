"use client";

import { useId, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BellRing, CalendarClock, Loader2, Lock, UserCheck, UserCog, XCircle } from "lucide-react";
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
import { assignTechnicianAction, cancelOrderAction, closeJobAction, rescheduleOrderAction } from "@/app/(app)/admin/actions";
import { CANCEL_REASONS } from "@/lib/workflow";
import { fromMytInputValue, toMytInputValue } from "./datetime";
import { cancelOrderSchema, rescheduleSchema, type CancelOrderValues, type RescheduleValues } from "./order-schema";
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

// ------------------------------------------------------------------ cancel --

export function CancelOrderDialog({
  orderId,
  orderNo,
  technicianName,
  triggerClassName,
}: {
  orderId: string;
  orderNo: string;
  technicianName: string | null;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ids = useId();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CancelOrderValues>({
    resolver: zodResolver(cancelOrderSchema),
    defaultValues: { reason: undefined, note: "" },
  });
  const reason = useWatch({ control, name: "reason" });

  const onSubmit = handleSubmit(async (v) => {
    const res = await cancelOrderAction(orderId, v);
    if (!res.ok) {
      for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
        if (name === "reason" || name === "note") setError(name, { message });
      }
      toast.error("Couldn't cancel the order", { description: res.error });
      return;
    }
    toast.success(`${orderNo} cancelled`, {
      description: technicianName
        ? `${technicianName} and the customer have been notified. Messages are in the WhatsApp outbox.`
        : "The customer has been notified. The message is in the WhatsApp outbox.",
    });
    setOpen(false);
    reset();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" size="sm" className={cn("text-destructive hover:text-destructive h-8", triggerClassName)} />}
      >
        <XCircle /> Cancel order
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Cancel {orderNo}?</DialogTitle>
            <DialogDescription>
              The order is kept for history and can&apos;t be reopened. To serve the customer later, create a new order.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">
              Reason <span className="text-destructive">*</span>
            </legend>
            <div className="grid gap-1.5" role="radiogroup" aria-invalid={!!errors.reason}>
              {CANCEL_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={cn(
                    "hover:bg-muted/50 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors sm:min-h-9",
                    reason === r.value && "border-destructive/50 bg-destructive/5",
                  )}
                >
                  <input type="radio" value={r.value} className="accent-destructive size-4" {...register("reason")} />
                  {r.label}
                </label>
              ))}
            </div>
            {errors.reason && <p className="text-destructive text-xs">{errors.reason.message}</p>}
          </fieldset>

          <FormField
            label="Note"
            htmlFor={`${ids}-note`}
            required={reason === "other"}
            error={errors.note?.message}
            hint="Recorded in the audit trail."
          >
            <Textarea
              id={`${ids}-note`}
              rows={2}
              placeholder={reason === "other" ? "What happened?" : "Optional, e.g. customer will call back next month"}
              aria-invalid={!!errors.note}
              {...register("note")}
            />
          </FormField>

          <div className="bg-muted/50 text-muted-foreground flex gap-2.5 rounded-lg px-3 py-2.5 text-xs">
            <BellRing className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {technicianName ? (
                <>
                  <span className="text-foreground font-medium">{technicianName}</span> gets a WhatsApp and in-app alert not to go
                  to site, and the customer gets a cancellation notice.
                </>
              ) : (
                "The customer gets a cancellation notice on WhatsApp."
              )}
            </span>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Keep order</DialogClose>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : <XCircle />}
              Cancel order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
