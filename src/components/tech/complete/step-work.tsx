"use client";

import { Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { Chip } from "../chip";
import { WORK_DONE_CHIPS } from "../lib";
import { ReadOnlyField, StepError, StepIntro } from "./fields";

function lines(text: string) {
  return text.split("\n").map((l) => l.trim());
}

export function StepWork({
  orderNo,
  serviceName,
  value,
  onChange,
  error,
}: {
  orderNo: string;
  serviceName: string;
  value: string;
  onChange: (v: string) => void;
  error: string | null;
}) {
  const current = lines(value);

  function toggle(chip: string) {
    if (current.includes(chip)) {
      onChange(
        value
          .split("\n")
          .filter((l) => l.trim() !== chip)
          .join("\n"),
      );
    } else {
      const base = value.replace(/\s+$/, "");
      onChange(base ? `${base}\n${chip}` : chip);
    }
  }

  return (
    <div className="space-y-5">
      <StepIntro title="Work done" description="What did you do on site? Tap common tasks or type your own." />
      <div className="grid grid-cols-2 gap-2">
        <ReadOnlyField label="Order ID" value={orderNo} mono />
        <ReadOnlyField label="Service" value={<span className="block truncate text-sm">{serviceName}</span>} />
      </div>

      <FormField label="Work done" htmlFor="work-done" required>
        <Textarea
          id="work-done"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={"e.g. Chemical wash on 2 indoor units\nGas top-up (R32), pressure 120 psi"}
          aria-invalid={!!error}
          maxLength={4000}
          className="min-h-36 rounded-xl text-base leading-relaxed"
        />
      </FormField>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium">Quick add</p>
        <div className="flex flex-wrap gap-2">
          {WORK_DONE_CHIPS.map((chip) => {
            const selected = current.includes(chip);
            return (
              <Chip key={chip} selected={selected} onClick={() => toggle(chip)}>
                {!selected && <Plus className="size-3.5" />}
                {chip}
              </Chip>
            );
          })}
        </div>
      </div>

      <StepError message={error} />
    </div>
  );
}
