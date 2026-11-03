"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FormField } from "@/components/shared/form-field";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { rescheduleJobAction } from "@/app/(app)/tech/actions";
import { Chip } from "./chip";
import { RESCHEDULE_REASONS, fromMytInputValue, mytSlot, toMytInputValue } from "./lib";

const QUICK_SLOTS = [
  { label: "Tomorrow 10 AM", days: 1, hour: 10 },
  { label: "Tomorrow 2 PM", days: 1, hour: 14 },
  { label: "In 2 days", days: 2, hour: 10 },
] as const;

/** Bottom sheet: pick a new slot + reason → rpc reschedule_order. */
export function RescheduleSheet({
  orderId,
  orderNo,
  currentScheduledAt,
  compact,
}: {
  orderId: string;
  orderNo: string;
  currentScheduledAt: string | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [min, setMin] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    if (next) {
      // Fresh defaults every time the sheet opens: same time tomorrow, or tomorrow 10 AM.
      const now = new Date();
      const current = currentScheduledAt ? new Date(currentScheduledAt) : null;
      const base =
        current && current.getTime() > now.getTime()
          ? toMytInputValue(new Date(current.getTime() + 24 * 60 * 60 * 1000))
          : mytSlot(1, 10, now);
      setWhen(base);
      setMin(toMytInputValue(now));
      setReason(null);
      setDetails("");
      setError(null);
    }
    setOpen(next);
  }

  function submit() {
    const fullReason = [reason, details.trim()].filter(Boolean).join(" — ");
    if (!when) return setError("Pick the new date and time");
    if (fromMytInputValue(when).getTime() < Date.now()) return setError("The new slot must be in the future");
    if (fullReason.length < 3) return setError("Choose a reason or describe what happened");
    setError(null);
    startTransition(async () => {
      const res = await rescheduleJobAction({ orderId, scheduledAt: when, reason: fullReason });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Job rescheduled", { description: `${orderNo} moved to ${formatDateTime(res.data.scheduledAt)}` });
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            className={cn("h-12 shrink-0 rounded-xl", compact ? "w-12 px-0" : "px-4")}
            aria-label="Reschedule job"
          />
        }
      >
        <CalendarClock className="size-5" />
        {!compact && <span>Reschedule</span>}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="safe-bottom mx-auto max-h-[92dvh] max-w-lg gap-0 overflow-y-auto rounded-t-3xl p-0"
      >
        <div className="bg-muted-foreground/25 mx-auto mt-2.5 h-1.5 w-10 rounded-full" aria-hidden />
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg font-semibold">Reschedule {orderNo}</SheetTitle>
          <SheetDescription>
            Currently {currentScheduledAt ? formatDateTime(currentScheduledAt) : "not scheduled"}. The office and audit
            log are updated automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-2">
          <FormField label="New date & time (MYT)" htmlFor="reschedule-when" required>
            <Input
              id="reschedule-when"
              type="datetime-local"
              value={when}
              min={min}
              onChange={(e) => setWhen(e.target.value)}
              className="h-12 rounded-xl text-base"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_SLOTS.map((s) => (
                <Chip
                  key={s.label}
                  showCheck={false}
                  className="min-h-9 px-3 text-[13px]"
                  onClick={() => setWhen(mytSlot(s.days, s.hour))}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </FormField>

          <FormField label="Reason" required>
            <div className="flex flex-wrap gap-2">
              {RESCHEDULE_REASONS.map((r) => (
                <Chip key={r} selected={reason === r} onClick={() => setReason(reason === r ? null : r)}>
                  {r}
                </Chip>
              ))}
            </div>
          </FormField>

          <FormField label="Details" htmlFor="reschedule-details" hint="Optional — anything the office should know.">
            <Textarea
              id="reschedule-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g. Customer asked to come after 3 PM"
              maxLength={400}
              className="min-h-20 rounded-xl text-base"
            />
          </FormField>

          {error && (
            <p role="alert" className="text-destructive bg-destructive/8 rounded-lg px-3 py-2 text-sm font-medium">
              {error}
            </p>
          )}
        </div>

        <SheetFooter className="pt-3">
          <Button className="h-12 w-full rounded-xl text-base" disabled={pending} onClick={submit}>
            {pending ? <Loader2 className="size-5 animate-spin" /> : <CalendarClock className="size-5" />}
            Confirm new slot
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
