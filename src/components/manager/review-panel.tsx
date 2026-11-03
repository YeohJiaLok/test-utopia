"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Lock, RotateCcw, ShieldAlert, Star } from "lucide-react";
import { toast } from "sonner";
import { closeOrder, reviewOrder } from "@/app/(app)/manager/actions";
import { EASE } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { canPerform, STATUS_META } from "@/lib/workflow";
import type { AppRole, FlagSeverity, OrderStatus, Review } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RATING_LABELS, StarRating } from "./star-rating";

export interface ReviewPanelProps {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  role: AppRole;
  review: Review | null;
  reviewedAt: string | null;
  closedAt: string | null;
  openFlags: { severity: FlagSeverity }[];
  queue: { position: number; total: number; prevId: string | null; nextId: string | null };
}

function ReviewSummary({ review }: { review: Review }) {
  const approved = review.decision === "approved";
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
            approved ? "bg-teal-500/10 text-teal-700 dark:text-teal-300" : "bg-red-500/10 text-red-700 dark:text-red-300",
          )}
        >
          {approved ? <CheckCircle2 className="size-3" /> : <RotateCcw className="size-3" />}
          {approved ? "Approved" : "Rework requested"}
        </span>
        <span className="text-muted-foreground text-[11px]">{formatDateTime(review.created_at)}</span>
      </div>
      {review.rating !== null && (
        <p className="flex items-center gap-1 text-sm">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              aria-hidden
              className={cn("size-4", i < (review.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
            />
          ))}
          <span className="text-muted-foreground ml-1 text-xs">{RATING_LABELS[review.rating]}</span>
          <span className="sr-only">{review.rating} of 5 stars</span>
        </p>
      )}
      {review.notes && <p className="text-muted-foreground text-sm">“{review.notes}”</p>}
    </div>
  );
}

/** Sticky decision panel for the review workspace (approve / rework / close). */
export function ReviewPanel(props: ReviewPanelProps) {
  const { orderId, orderNo, status, role, review, queue, openFlags } = props;
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ rating?: string; notes?: string; form?: string }>({});
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"approved" | "rework" | "close" | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const ctx = { status, role, isAssignedTechnician: false };
  const canReview = canPerform("review", ctx);
  const canClose = canPerform("close", ctx);
  const highFlags = openFlags.filter((f) => f.severity === "high").length;

  const decide = (decision: "approved" | "rework") => {
    const next: typeof errors = {};
    if (decision === "approved" && rating === null) next.rating = "Rate the job before approving.";
    if (decision === "rework" && notes.trim().length < 5) next.notes = "Tell the technician what needs to be redone.";
    setErrors(next);
    if (next.notes) notesRef.current?.focus();
    if (next.rating || next.notes) return;

    setBusy(decision);
    start(async () => {
      const res = await reviewOrder({ orderId, decision, rating, notes });
      if (!res.ok) {
        setErrors({ form: res.error });
        setBusy(null);
        toast.error(res.error);
        return;
      }
      toast.success(decision === "approved" ? `${orderNo} approved` : `${orderNo} sent back for rework`, {
        description: res.nextId ? "Opening the next job in the queue…" : "Review queue is clear — nice work.",
      });
      router.push(res.nextId ? `/manager/orders/${res.nextId}` : "/manager/reviews");
    });
  };

  const close = () => {
    setBusy("close");
    start(async () => {
      const res = await closeOrder(orderId);
      setBusy(null);
      if (!res.ok) {
        setErrors({ form: res.error });
        toast.error(res.error);
        return;
      }
      toast.success(`${orderNo} closed`, { description: "The order is finalised and archived." });
      router.refresh();
    });
  };

  return (
    <section className="bg-card rounded-xl border shadow-sm" aria-labelledby="review-panel-title">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="review-panel-title" className="text-sm font-semibold">
          Manager review
        </h2>
        <span className="text-muted-foreground text-xs">{STATUS_META[status].description}</span>
      </header>

      <div className="space-y-4 p-4">
        <AnimatePresence mode="wait" initial={false}>
          {canReview ? (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="space-y-4"
            >
              {review?.decision === "rework" && (
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-xs">
                  <p className="font-medium text-violet-700 dark:text-violet-300">Resubmitted after rework</p>
                  {review.notes && <p className="text-muted-foreground mt-0.5">Previous note: “{review.notes}”</p>}
                </div>
              )}
              {openFlags.length > 0 && (
                <a
                  href="#ai-flags"
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-3 text-xs transition-colors",
                    highFlags
                      ? "border-red-500/25 bg-red-500/5 hover:bg-red-500/10"
                      : "border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10",
                  )}
                >
                  <ShieldAlert className={cn("mt-px size-4 shrink-0", highFlags ? "text-red-600" : "text-amber-600")} />
                  <span>
                    <span className="font-medium">
                      {openFlags.length} open AI flag{openFlags.length > 1 ? "s" : ""}
                      {highFlags ? ` (${highFlags} high)` : ""}
                    </span>
                    <span className="text-muted-foreground block">Review the supervisor findings before you decide.</span>
                  </span>
                </a>
              )}

              <div className="space-y-1.5">
                <p className="text-[13px] leading-none font-medium">Quality rating</p>
                <StarRating
                  id="review-rating"
                  value={rating}
                  onChange={(v) => {
                    setRating(v);
                    setErrors((e) => ({ ...e, rating: undefined }));
                  }}
                  disabled={pending}
                  invalid={!!errors.rating}
                />
                {errors.rating && <p className="text-destructive text-xs font-medium">{errors.rating}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="review-notes" className="text-[13px]">
                  Notes <span className="text-muted-foreground font-normal">(required for rework)</span>
                </Label>
                <Textarea
                  id="review-notes"
                  ref={notesRef}
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    if (errors.notes) setErrors((er) => ({ ...er, notes: undefined }));
                  }}
                  rows={4}
                  maxLength={2000}
                  placeholder="Feedback for the technician, e.g. missing after-photos of the indoor unit"
                  aria-invalid={!!errors.notes}
                  disabled={pending}
                />
                {errors.notes && <p className="text-destructive text-xs font-medium">{errors.notes}</p>}
              </div>

              {errors.form && <p className="text-destructive rounded-md bg-red-500/5 px-3 py-2 text-xs font-medium">{errors.form}</p>}

              <div className="grid gap-2">
                <Button size="lg" className="h-10" disabled={pending} onClick={() => decide("approved")}>
                  {busy === "approved" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  {highFlags ? `Approve despite ${highFlags} high flag${highFlags > 1 ? "s" : ""}` : "Approve job"}
                </Button>
                <Button size="lg" variant="destructive" className="h-10" disabled={pending} onClick={() => decide("rework")}>
                  {busy === "rework" ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                  Request rework
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`state-${status}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="space-y-3"
            >
              {review ? (
                <ReviewSummary review={review} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  {status === "job_done"
                    ? "Only managers can approve or send jobs back for rework."
                    : "This order has not been completed yet — the review opens once the technician submits the job."}
                </p>
              )}
              {status === "closed" && (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Lock className="size-3.5" /> Closed {formatDateTime(props.closedAt)}
                </p>
              )}
              {canClose && (
                <Button size="lg" className="h-10 w-full" disabled={pending} onClick={close}>
                  {busy === "close" ? <Loader2 className="animate-spin" /> : <Lock />}
                  Close order
                </Button>
              )}
              {status === "reviewed" && !canClose && (
                <p className="text-muted-foreground text-xs">Approved {formatDateTime(props.reviewedAt)} · awaiting closure.</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {queue.total > 0 && (
        <footer className="text-muted-foreground flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs">
          {queue.prevId ? (
            <Link href={`/manager/orders/${queue.prevId}`} className="hover:text-foreground inline-flex items-center gap-0.5">
              <ChevronLeft className="size-3.5" /> Prev
            </Link>
          ) : (
            <span className="opacity-40">
              <ChevronLeft className="inline size-3.5" /> Prev
            </span>
          )}
          <Link href="/manager/reviews" className="hover:text-foreground tabular">
            {queue.position > 0 ? `${queue.position} of ${queue.total} in queue` : `${queue.total} in queue`}
          </Link>
          {queue.nextId ? (
            <Link href={`/manager/orders/${queue.nextId}`} className="hover:text-foreground inline-flex items-center gap-0.5">
              Next <ChevronRight className="size-3.5" />
            </Link>
          ) : (
            <span className="opacity-40">
              Next <ChevronRight className="inline size-3.5" />
            </span>
          )}
        </footer>
      )}
    </section>
  );
}
