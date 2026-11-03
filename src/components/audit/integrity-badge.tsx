"use client";

import { Fingerprint, ShieldAlert, ShieldCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ChainStatus {
  ok: boolean;
  checked: number;
  brokenSeq: number | null;
  reason: string | null;
  headHash: string | null;
  verifiedAt: string;
}

/**
 * Live result of verify_audit_chain(): the order-event ledger is a SHA-256 hash chain,
 * recomputed in the database every time this page loads.
 */
export function IntegrityBadge({ status }: { status: ChainStatus | null }) {
  if (!status) {
    return (
      <span className="bg-muted text-muted-foreground inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium">
        <ShieldAlert className="size-3.5" /> Integrity check unavailable
      </span>
    );
  }
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 transition-colors ring-inset",
              status.ok
                ? "bg-success/10 text-success ring-success/25 hover:bg-success/15"
                : "bg-destructive/10 text-destructive ring-destructive/30 hover:bg-destructive/15 animate-pulse",
            )}
          />
        }
      >
        {status.ok ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
        {status.ok ? `Integrity verified · ${status.checked.toLocaleString("en-MY")} events` : "Integrity alert"}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle className="flex items-center gap-2">
            <Fingerprint className="text-primary size-4" /> Tamper-evident ledger
          </PopoverTitle>
          <PopoverDescription>
            Every order event stores a SHA-256 hash of its content and of the event before it. The database recomputed the whole
            chain when this page loaded.
          </PopoverDescription>
        </PopoverHeader>
        <dl className="mt-3 space-y-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Result</dt>
            <dd className={cn("font-medium", status.ok ? "text-success" : "text-destructive")}>
              {status.ok ? "Chain intact" : `Broken at #${status.brokenSeq}: ${status.reason}`}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Events verified</dt>
            <dd className="tabular font-medium">{status.checked.toLocaleString("en-MY")}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Checked at</dt>
            <dd className="font-medium">{formatDateTime(status.verifiedAt)}</dd>
          </div>
          {status.headHash && (
            <div className="space-y-1">
              <dt className="text-muted-foreground">Latest hash</dt>
              <dd className="bg-muted rounded-md px-2 py-1.5 font-mono text-[10.5px] break-all">{status.headHash}</dd>
            </div>
          )}
        </dl>
        <p className="text-muted-foreground mt-3 border-t pt-3 text-[11px] leading-relaxed">
          Edits are rejected by the database for every user. Any change, deletion or reordering of past events breaks the chain and
          shows here.
        </p>
      </PopoverContent>
    </Popover>
  );
}
