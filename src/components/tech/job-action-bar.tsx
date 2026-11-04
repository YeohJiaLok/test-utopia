"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ClipboardCheck, Loader2, PlayCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";
import { startJobAction } from "@/app/(app)/tech/actions";
import { BottomBar } from "./bottom-bar";
import { RescheduleSheet } from "./reschedule-sheet";

interface JobActionProps {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  scheduledAt: string | null;
}

function useStartJob(orderId: string) {
  const [pending, startTransition] = useTransition();
  function startJob() {
    startTransition(async () => {
      const res = await startJobAction(orderId);
      if (!res.ok) {
        toast.error("Couldn't start the job", { description: res.error });
        return;
      }
      navigator.vibrate?.(15);
      toast.success("Job started", {
        description: "Status is now In Progress. Complete it when you're done.",
      });
    });
  }
  return { pending, startJob };
}

/** Sticky primary actions on the job detail screen (phones & tablets). */
export function JobActionBar({ orderId, orderNo, status, scheduledAt }: JobActionProps) {
  const { pending, startJob } = useStartJob(orderId);
  const completeHref = `/tech/jobs/${orderId}/complete`;

  if (status !== "assigned" && status !== "in_progress" && status !== "rework") return null;

  return (
    <BottomBar>
      <div className="flex items-center gap-2">
        {status !== "rework" && (
          <RescheduleSheet orderId={orderId} orderNo={orderNo} currentScheduledAt={scheduledAt} compact={status === "assigned"} />
        )}
        {status === "rework" ? (
          <Link href={completeHref} className={cn(buttonVariants(), "h-12 flex-1 rounded-xl text-[15px] font-semibold")}>
            <RotateCcw className="size-5" />
            Fix &amp; resubmit
          </Link>
        ) : status === "assigned" ? (
          <>
            {/* Completing comes after starting: Assigned → In Progress → Job Done. */}
            <Button className="h-12 flex-1 rounded-xl text-[15px] font-semibold" disabled={pending} onClick={startJob}>
              {pending ? <Loader2 className="size-5 animate-spin" /> : <PlayCircle className="size-5" />}
              Start job
            </Button>
          </>
        ) : (
          <Link href={completeHref} className={cn(buttonVariants(), "h-12 flex-1 rounded-xl text-[15px] font-semibold")}>
            <ClipboardCheck className="size-5" />
            Complete job
          </Link>
        )}
      </div>
    </BottomBar>
  );
}

/** The same actions as an inline "Next step" card for the desktop side panel. */
export function JobActionPanel({ orderId, orderNo, status, scheduledAt, className }: JobActionProps & { className?: string }) {
  const { pending, startJob } = useStartJob(orderId);
  const completeHref = `/tech/jobs/${orderId}/complete`;

  if (status !== "assigned" && status !== "in_progress" && status !== "rework") return null;
  const assigned = status === "assigned";
  const rework = status === "rework";

  return (
    <section className={cn("bg-card relative overflow-hidden rounded-2xl border p-5 shadow-xs", className)}>
      <div className="bg-gradient-brand absolute inset-x-0 top-0 h-1" aria-hidden />
      <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Next step</p>
      <p className="mt-1 text-base font-semibold">{assigned ? "Arrived on site?" : rework ? "Fixed what the manager asked?" : "Finished the work?"}</p>
      <p className="text-muted-foreground mt-0.5 text-sm">
        {assigned
          ? "Start the job so the office can see you're working on it."
          : rework
            ? "Update the work notes and photos, then resubmit it for review."
            : "Record the work, charges, photos and payment to close it out."}
      </p>
      <div className="mt-4 grid gap-2">
        {rework ? (
          <Link href={completeHref} className={cn(buttonVariants(), "h-11 rounded-xl text-[15px] font-semibold")}>
            <RotateCcw className="size-5" />
            Fix &amp; resubmit
          </Link>
        ) : assigned ? (
          <>
            <Button className="h-11 rounded-xl text-[15px] font-semibold" disabled={pending} onClick={startJob}>
              {pending ? <Loader2 className="size-5 animate-spin" /> : <PlayCircle className="size-5" />}
              Start job
            </Button>
          </>
        ) : (
          <Link href={completeHref} className={cn(buttonVariants(), "h-11 rounded-xl text-[15px] font-semibold")}>
            <ClipboardCheck className="size-5" />
            Complete job
          </Link>
        )}
        {!rework && <RescheduleSheet orderId={orderId} orderNo={orderNo} currentScheduledAt={scheduledAt} block />}
      </div>
    </section>
  );
}
