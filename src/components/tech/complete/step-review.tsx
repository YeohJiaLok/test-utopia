"use client";

import { Clock, FileText, Pencil, UserRound } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { formatMYR } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/workflow";
import type { PaymentMethod } from "@/lib/types";
import { StepError, StepIntro, LiveClock } from "./fields";
import type { MediaItem } from "./use-media-uploads";

function Row({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <div className="mt-0.5 text-sm">{children}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${label.toLowerCase()}`}
        className="text-primary hover:bg-primary/8 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg"
      >
        <Pencil className="size-4" />
      </button>
    </div>
  );
}

export function StepReview({
  orderNo,
  workDone,
  quoted,
  extra,
  finalAmount,
  media,
  payment,
  remarks,
  onRemarksChange,
  technicianName,
  onEdit,
  error,
}: {
  orderNo: string;
  workDone: string;
  quoted: number;
  extra: number;
  finalAmount: number;
  media: MediaItem[];
  payment: { method: PaymentMethod; amount: number; receipt: boolean } | null;
  remarks: string;
  onRemarksChange: (v: string) => void;
  technicianName: string;
  onEdit: (step: number) => void;
  error: string | null;
}) {
  const photos = media.filter((m) => m.kind === "photo").length;
  const others = media.length - photos;

  return (
    <div className="space-y-5">
      <StepIntro title="Review & submit" description="Check everything, add remarks, then mark the job as done." />

      <div className="bg-card divide-y rounded-2xl border p-4">
        <Row label="Work done" onEdit={() => onEdit(0)}>
          <p className="line-clamp-4 whitespace-pre-line">{workDone}</p>
        </Row>
        <Row label="Charges" onEdit={() => onEdit(1)}>
          <div className="grid grid-cols-3 gap-2 tabular-nums">
            <span>
              <span className="text-muted-foreground block text-[11px]">Quoted</span>
              {formatMYR(quoted)}
            </span>
            <span>
              <span className="text-muted-foreground block text-[11px]">Extra</span>
              {formatMYR(extra)}
            </span>
            <span className="font-semibold">
              <span className="text-muted-foreground block text-[11px] font-normal">Final</span>
              {formatMYR(finalAmount)}
            </span>
          </div>
        </Row>
        <Row label="Media" onEdit={() => onEdit(2)}>
          {media.length ? (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {media.slice(0, 4).map((m) =>
                  m.kind === "photo" && m.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={m.key} src={m.previewUrl} alt="" className="ring-card size-8 rounded-lg object-cover ring-2" />
                  ) : (
                    <span key={m.key} className="bg-muted ring-card flex size-8 items-center justify-center rounded-lg ring-2">
                      <FileText className="text-muted-foreground size-4" />
                    </span>
                  ),
                )}
              </div>
              <span>
                {photos} photo{photos === 1 ? "" : "s"}
                {others ? ` · ${others} other` : ""}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">No files attached</span>
          )}
        </Row>
        <Row label="Payment" onEdit={() => onEdit(3)}>
          {payment ? (
            <span>
              {PAYMENT_METHOD_LABELS[payment.method]}
              {payment.method !== "unpaid" && <span className="font-semibold tabular-nums"> · {formatMYR(payment.amount)}</span>}
              {payment.receipt && <span className="text-muted-foreground"> · receipt attached</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">Not recorded</span>
          )}
        </Row>
      </div>

      <FormField
        label="Remarks"
        htmlFor="remarks"
        required={extra > 0}
        hint={extra > 0 ? "Explain the extra charges for the manager." : "Anything the office or manager should know."}
      >
        <Textarea
          id="remarks"
          value={remarks}
          onChange={(e) => onRemarksChange(e.target.value)}
          placeholder={extra > 0 ? "e.g. Replaced faulty capacitor (RM 50), customer approved" : "Optional"}
          maxLength={2000}
          aria-invalid={!!error}
          className="min-h-24 rounded-xl text-base"
        />
      </FormField>

      <div className="grid gap-2">
        <div className="bg-muted/60 flex items-center gap-3 rounded-xl border border-dashed px-3.5 py-2.5">
          <UserRound className="text-muted-foreground size-4" />
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Technician</p>
            <p className="truncate text-sm font-semibold">{technicianName}</p>
          </div>
        </div>
        <div className="bg-muted/60 flex items-center gap-3 rounded-xl border border-dashed px-3.5 py-2.5">
          <Clock className="text-muted-foreground size-4" />
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Timestamp (MYT)</p>
            <LiveClock className="text-sm font-semibold" />
          </div>
        </div>
      </div>

      <p className="text-muted-foreground text-center text-xs">
        Submitting sets {orderNo} to <span className="text-foreground font-medium">Job Done</span> and notifies the manager.
      </p>

      <StepError message={error} />
    </div>
  );
}
