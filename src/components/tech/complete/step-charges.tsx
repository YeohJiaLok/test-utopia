"use client";

import { Equal, Plus } from "lucide-react";
import { CountUp } from "@/components/motion";
import { FormField } from "@/components/shared/form-field";
import { formatMYR } from "@/lib/format";
import { Chip } from "../chip";
import { EXTRA_CHARGE_CHIPS, parseAmount, round2 } from "../lib";
import { MoneyInput, ReadOnlyField, StepError, StepIntro } from "./fields";

const money = (n: number) => formatMYR(n);

export function StepCharges({
  quoted,
  extra,
  onExtraChange,
  finalAmount,
  error,
}: {
  quoted: number;
  extra: string;
  onExtraChange: (v: string) => void;
  finalAmount: number;
  error: string | null;
}) {
  const extraValue = parseAmount(extra) ?? 0;

  return (
    <div className="space-y-5">
      <StepIntro title="Charges" description="Add anything beyond the quote — parts, gas, extra units." />

      <ReadOnlyField label="Quoted price" value={formatMYR(quoted)} />

      <FormField label="Extra charges" htmlFor="extra-charges" hint="Leave empty if there were no extras.">
        <MoneyInput
          id="extra-charges"
          value={extra}
          placeholder="0.00"
          aria-invalid={!!error}
          onChange={(e) => onExtraChange(e.target.value.replace(/[^\d.]/g, ""))}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          {EXTRA_CHARGE_CHIPS.map((n) => (
            <Chip key={n} showCheck={false} onClick={() => onExtraChange(String(round2(extraValue + n)))}>
              <Plus className="size-3.5" />
              RM{n}
            </Chip>
          ))}
          {extra !== "" && (
            <Chip showCheck={false} className="text-muted-foreground" onClick={() => onExtraChange("")}>
              Clear
            </Chip>
          )}
        </div>
      </FormField>

      <StepError message={error} />

      <div className="bg-gradient-brand relative overflow-hidden rounded-2xl p-5 text-white shadow-lg shadow-brand/20">
        <div className="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full bg-white/10 blur-2xl" />
        <p className="flex items-center gap-1.5 text-xs font-medium text-white/85">
          <Equal className="size-3.5" /> Final amount
        </p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">
          <CountUp value={finalAmount} format={money} duration={0.6} />
        </p>
        <p className="mt-1.5 text-xs text-white/85 tabular-nums">
          {formatMYR(quoted)} quoted + {formatMYR(extraValue)} extra
        </p>
      </div>
    </div>
  );
}
