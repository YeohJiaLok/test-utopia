"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ClipboardCheck, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";
import { startJobAction } from "@/app/(app)/tech/actions";
import { BottomBar } from "./bottom-bar";
import { RescheduleSheet } from "./reschedule-sheet";

/** Sticky primary actions on the job detail screen. */
export function JobActionBar({
  orderId,
  orderNo,
  status,
  scheduledAt,
}: {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  scheduledAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const completeHref = `/tech/jobs/${orderId}/complete`;

  function startJob() {
    startTransition(async () => {
      const res = await startJobAction(orderId);
      if (!res.ok) {
        toast.error("Couldn't start the job", { description: res.error });
        return;
      }
      navigator.vibrate?.(15);
      toast.success("Job started", { description: "Status is now In Progress. Complete it when you're done." });
    });
  }

  if (status !== "assigned" && status !== "in_progress") return null;

  return (
    <BottomBar>
      <div className="flex items-center gap-2">
        <RescheduleSheet orderId={orderId} orderNo={orderNo} currentScheduledAt={scheduledAt} compact={status === "assigned"} />
        {status === "assigned" ? (
          <>
            <Link
              href={completeHref}
              className={cn(buttonVariants({ variant: "outline" }), "h-12 flex-1 rounded-xl text-[15px]")}
            >
              Complete
            </Link>
            <Button className="h-12 flex-[1.4] rounded-xl text-[15px]" disabled={pending} onClick={startJob}>
              {pending ? <Loader2 className="size-5 animate-spin" /> : <PlayCircle className="size-5" />}
              Start job
            </Button>
          </>
        ) : (
          <Link
            href={completeHref}
            className={cn(buttonVariants(), "h-12 flex-1 rounded-xl text-[15px]")}
          >
            <ClipboardCheck className="size-5" />
            Complete job
          </Link>
        )}
      </div>
    </BottomBar>
  );
}
