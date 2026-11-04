"use client";

import { useEffect, useId, useState } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, FilePlus2, FileText, Loader2, Send, Sparkles, User, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, NativeSelect } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { DocumentImportButton } from "@/components/ai/document-import";
import { EASE } from "@/components/motion";
import { formatDateTime, formatMYR } from "@/lib/format";
import type { ExtractedOrderFields } from "@/lib/ai/contracts";
import type { TechnicianWithLoad } from "@/lib/data/reference";
import type { ServiceType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createOrderAction, peekNextOrderNo, type CreatedOrderSummary } from "@/app/(app)/admin/actions";
import { AiChip, aiFieldClass } from "./ai-chip";
import { documentDateToInputValue, fromMytInputValue } from "./datetime";
import { ORDER_FORM_DEFAULTS, formatMyMobile, orderFormSchema, type OrderFormValues } from "./order-schema";
import { OrderSuccess } from "./order-success";
import { TechnicianPicker } from "./technician-picker";

type Field = FieldPath<OrderFormValues>;

/** Fields the schema requires — drives the "required details" progress hint. */
const REQUIRED = ["customerName", "customerPhone", "customerAddress", "serviceTypeId", "quotedPrice", "problemDescription", "technicianId"] as const;

function Section({
  icon: Icon,
  title,
  description,
  children,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
      className="bg-card rounded-xl border shadow-xs"
    >
      <header className="flex items-start gap-3 border-b px-4 py-3 sm:px-5">
        <span className="bg-primary/8 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </header>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">{children}</div>
    </motion.section>
  );
}

export function OrderForm({
  serviceTypes,
  technicians,
  initialOrderNo,
  orderNoPrefix,
}: {
  serviceTypes: ServiceType[];
  technicians: TechnicianWithLoad[];
  /** Next order number from the database sequence (null if it couldn't be read). */
  initialOrderNo: string | null;
  orderNoPrefix: string;
}) {
  const ids = useId();
  const id = (name: string) => `${ids}-${name}`;

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: ORDER_FORM_DEFAULTS,
    mode: "onTouched",
  });

  const values = useWatch({ control });
  const [aiFields, setAiFields] = useState<Partial<Record<Field, number>>>({});
  const [aiDoc, setAiDoc] = useState<{ documentType: string; summary: string } | null>(null);
  const [source, setSource] = useState<"manual" | "ai_document">("manual");
  const [priceTouched, setPriceTouched] = useState(false);
  const [created, setCreated] = useState<CreatedOrderSummary | null>(null);
  const [nextOrderNo, setNextOrderNo] = useState(initialOrderNo);

  // Keep the previewed number current: another admin may save an order while this one is open.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void peekNextOrderNo().then((n) => n && setNextOrderNo(n));
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const service = serviceTypes.find((s) => String(s.id) === values.serviceTypeId) ?? null;
  const tech = technicians.find((t) => t.id === values.technicianId) ?? null;
  const scheduledIso = fromMytInputValue(values.scheduledAt);
  const price = Number(values.quotedPrice);
  const filledCount = REQUIRED.filter((k) => String(values[k] ?? "").trim() !== "").length;

  function clearAi(name: Field) {
    setAiFields((prev) => {
      if (prev[name] === undefined) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function aside(name: Field) {
    const c = aiFields[name];
    return <AnimatePresence>{c !== undefined && <AiChip key="ai" confidence={c} />}</AnimatePresence>;
  }

  /** register() that also clears the AI highlight as soon as the user edits the field. */
  function field(name: Field) {
    return register(name, { onChange: () => clearAi(name) });
  }

  function applyExtraction(f: ExtractedOrderFields) {
    const filled: Partial<Record<Field, number>> = {};
    const put = (name: Field, value: string | null | undefined, confidence: number) => {
      if (value === null || value === undefined || value.trim() === "") return;
      setValue(name, value.trim(), { shouldValidate: true, shouldDirty: true });
      filled[name] = confidence;
    };

    put("customerName", f.customerName.value, f.customerName.confidence);
    put("customerPhone", f.phone.value ? formatMyMobile(f.phone.value) : null, f.phone.confidence);
    put("customerAddress", f.address.value, f.address.confidence);
    put("problemDescription", f.serviceDetails.value, f.serviceDetails.confidence);

    const code = f.serviceTypeCode.value?.trim().toLowerCase();
    const matched = code ? serviceTypes.find((s) => s.code.toLowerCase() === code) : undefined;
    if (matched) put("serviceTypeId", String(matched.id), f.serviceTypeCode.confidence);

    if (typeof f.amount.value === "number" && Number.isFinite(f.amount.value) && f.amount.value >= 0) {
      put("quotedPrice", f.amount.value.toFixed(2), f.amount.confidence);
      setPriceTouched(true);
    } else if (matched && !priceTouched) {
      setValue("quotedPrice", matched.base_price.toFixed(2), { shouldValidate: true });
    }

    const when = documentDateToInputValue(f.date.value);
    if (when) put("scheduledAt", when, f.date.confidence);

    const count = Object.keys(filled).length;
    setAiFields(filled);
    setAiDoc({ documentType: f.documentType, summary: f.summary });
    setSource("ai_document");
    if (count) toast.success(`Filled ${count} field${count === 1 ? "" : "s"} from the ${f.documentType || "document"}`, { description: "Review the highlighted values before saving." });
    else toast.warning("Nothing usable was found in that document", { description: "Fill the order in manually." });
  }

  const onSubmit = handleSubmit(async (v) => {
    const res = await createOrderAction(v, { source });
    if (!res.ok) {
      for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
        if (name in ORDER_FORM_DEFAULTS) setError(name as Field, { message });
      }
      toast.error("Order not created", { description: res.error });
      return;
    }
    setCreated(res.data);
    toast.success(`Order ${res.data.orderNo} created`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  function startOver() {
    reset(ORDER_FORM_DEFAULTS);
    setAiFields({});
    setAiDoc(null);
    setSource("manual");
    setPriceTouched(false);
    setCreated(null);
    setNextOrderNo(null);
    void peekNextOrderNo().then(setNextOrderNo);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const priceField = register("quotedPrice", {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      clearAi("quotedPrice");
      setPriceTouched(e.target.value.trim() !== "");
    },
  });

  const serviceField = register("serviceTypeId", {
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
      clearAi("serviceTypeId");
      const st = serviceTypes.find((s) => String(s.id) === e.target.value);
      if (st && !priceTouched) {
        setValue("quotedPrice", st.base_price.toFixed(2), { shouldValidate: true });
        clearAi("quotedPrice");
      }
    },
  });

  const phoneField = register("customerPhone", {
    onChange: () => clearAi("customerPhone"),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      const formatted = formatMyMobile(e.target.value);
      if (formatted !== e.target.value) setValue("customerPhone", formatted, { shouldValidate: true });
    },
  });

  return (
    <AnimatePresence mode="wait" initial={false}>
      {created ? (
        <OrderSuccess key="success" order={created} onReset={startOver} />
      ) : (
        <motion.form
          key="form"
          onSubmit={onSubmit}
          noValidate
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
          transition={{ duration: 0.35, ease: EASE }}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
          aria-busy={isSubmitting}
        >
          <div className="min-w-0 space-y-5">
            {/* AI document intake */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="relative overflow-hidden rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] via-transparent to-primary/[0.06] p-4 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-violet-600 dark:text-violet-300">
                  <Sparkles className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Start from a document</p>
                  <p className="text-muted-foreground text-xs">
                    Upload a quotation, job sheet or invoice — AI extracts the customer, service, amount and date for you to review.
                  </p>
                </div>
                <DocumentImportButton onExtracted={applyExtraction} className="shrink-0" />
              </div>
              <AnimatePresence>
                {aiDoc && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-violet-500/15 bg-background/70 p-2.5 text-xs">
                      <FileText className="mt-0.5 size-3.5 shrink-0 text-violet-600 dark:text-violet-300" />
                      <p className="min-w-0 flex-1">
                        <span className="font-medium capitalize">{aiDoc.documentType || "Document"}</span>
                        {aiDoc.summary && <span className="text-muted-foreground"> — {aiDoc.summary}</span>}
                      </p>
                      <button
                        type="button"
                        onClick={() => setAiDoc(null)}
                        className="text-muted-foreground hover:text-foreground rounded p-0.5"
                        aria-label="Dismiss document summary"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <Section icon={User} title="Customer" description="Who we're servicing and where." delay={0.05}>
              <FormField label="Customer name" htmlFor={id("customerName")} required error={errors.customerName?.message} aside={aside("customerName")}>
                <Input
                  id={id("customerName")}
                  autoComplete="name"
                  placeholder="e.g. Nur Aisyah binti Ahmad"
                  aria-invalid={!!errors.customerName}
                  className={cn("h-11 sm:h-9", aiFieldClass(aiFields.customerName !== undefined))}
                  {...field("customerName")}
                />
              </FormField>
              <FormField
                label="Phone"
                htmlFor={id("customerPhone")}
                required
                error={errors.customerPhone?.message}
                hint="Malaysian mobile, e.g. 012-345 6789"
                aside={aside("customerPhone")}
              >
                <Input
                  id={id("customerPhone")}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="012-345 6789"
                  aria-invalid={!!errors.customerPhone}
                  className={cn("h-11 sm:h-9 tabular", aiFieldClass(aiFields.customerPhone !== undefined))}
                  {...phoneField}
                />
              </FormField>
              <FormField
                label="Service address"
                htmlFor={id("customerAddress")}
                required
                error={errors.customerAddress?.message}
                className="sm:col-span-2"
                aside={aside("customerAddress")}
              >
                <Textarea
                  id={id("customerAddress")}
                  rows={2}
                  autoComplete="street-address"
                  placeholder="Unit, street, area, postcode, city"
                  aria-invalid={!!errors.customerAddress}
                  className={cn("min-h-16", aiFieldClass(aiFields.customerAddress !== undefined))}
                  {...field("customerAddress")}
                />
              </FormField>
            </Section>

            <Section icon={Wrench} title="Job" description="What needs doing and the agreed price." delay={0.1}>
              <FormField
                label="Service type"
                htmlFor={id("serviceTypeId")}
                required
                error={errors.serviceTypeId?.message}
                hint={service ? `Base price ${formatMYR(service.base_price)} · ~${service.est_minutes} min` : undefined}
                aside={aside("serviceTypeId")}
              >
                <NativeSelect
                  id={id("serviceTypeId")}
                  aria-invalid={!!errors.serviceTypeId}
                  className={cn("h-11 sm:h-9", aiFieldClass(aiFields.serviceTypeId !== undefined))}
                  {...serviceField}
                >
                  <option value="">Select a service…</option>
                  {serviceTypes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {formatMYR(s.base_price)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField
                label="Quoted price (RM)"
                htmlFor={id("quotedPrice")}
                required
                error={errors.quotedPrice?.message}
                hint={!priceTouched && service ? "Pre-filled from the service base price" : undefined}
                aside={aside("quotedPrice")}
              >
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm">RM</span>
                  <Input
                    id={id("quotedPrice")}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-invalid={!!errors.quotedPrice}
                    className={cn("h-11 sm:h-9 pl-10 text-right tabular", aiFieldClass(aiFields.quotedPrice !== undefined))}
                    {...priceField}
                  />
                </div>
              </FormField>
              <FormField
                label="Problem description"
                htmlFor={id("problemDescription")}
                required
                error={errors.problemDescription?.message}
                className="sm:col-span-2"
                aside={aside("problemDescription")}
              >
                <Textarea
                  id={id("problemDescription")}
                  rows={3}
                  placeholder="e.g. Living room 1.5HP unit not cold, water dripping from indoor unit since last week."
                  aria-invalid={!!errors.problemDescription}
                  className={cn("min-h-20", aiFieldClass(aiFields.problemDescription !== undefined))}
                  {...field("problemDescription")}
                />
              </FormField>
            </Section>

            <Section icon={CalendarClock} title="Dispatch" description="Every order is dispatched to a technician when it is created. Times are Malaysia time (MYT)." delay={0.15}>
              <FormField
                label="Assigned technician"
                htmlFor={id("technicianId")}
                required
                error={errors.technicianId?.message}
                hint={tech ? `${tech.team_code} · ${tech.skills.slice(0, 3).join(", ") || "General servicing"}` : "Least-loaded technician is recommended"}
                className="sm:col-span-2"
              >
                <Controller
                  control={control}
                  name="technicianId"
                  render={({ field: f }) => (
                    <TechnicianPicker
                      id={id("technicianId")}
                      technicians={technicians}
                      value={f.value || null}
                      onChange={(next) => f.onChange(next ?? "")}
                      invalid={!!errors.technicianId}
                      className="min-h-11 sm:min-h-9"
                    />
                  )}
                />
              </FormField>
              <FormField
                label="Scheduled at"
                htmlFor={id("scheduledAt")}
                error={errors.scheduledAt?.message}
                hint={scheduledIso ? formatDateTime(scheduledIso) + " MYT" : "Optional — leave blank if not yet confirmed"}
                aside={aside("scheduledAt")}
              >
                <Input
                  id={id("scheduledAt")}
                  type="datetime-local"
                  step={900}
                  aria-invalid={!!errors.scheduledAt}
                  className={cn("h-11 sm:h-9 tabular", aiFieldClass(aiFields.scheduledAt !== undefined))}
                  {...field("scheduledAt")}
                />
              </FormField>
              <FormField label="Admin notes" htmlFor={id("adminNotes")} error={errors.adminNotes?.message} hint="Internal only — gate codes, parking, preferred contact time.">
                <Textarea id={id("adminNotes")} rows={2} placeholder="Optional" className="min-h-9" {...field("adminNotes")} />
              </FormField>
            </Section>
          </div>

          {/* Live summary + submit */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE, delay: 0.2 }}
              className="bg-card overflow-hidden rounded-xl border shadow-xs"
            >
              <div className="bg-gradient-brand h-1" />
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs">Order preview</p>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.p
                        key={nextOrderNo ?? "pending"}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        className="font-mono text-sm font-semibold tabular"
                        title="Assigned automatically when you create the order"
                      >
                        {nextOrderNo ?? `${orderNoPrefix}-•••••`}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                  <StatusBadge status="assigned" />
                </div>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Customer</dt>
                    <dd className="truncate text-right font-medium">{values.customerName?.trim() || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Service</dt>
                    <dd className="truncate text-right">{service?.name ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Technician</dt>
                    <dd className={cn("truncate text-right", !tech && "text-muted-foreground")}>{tech?.name ?? "Not chosen"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Schedule</dt>
                    <dd className="text-right tabular">{scheduledIso ? formatDateTime(scheduledIso) : "TBC"}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t pt-3">
                    <dt className="text-muted-foreground">Quoted</dt>
                    <dd className="text-xl font-semibold tracking-tight tabular">
                      {values.quotedPrice && Number.isFinite(price) ? formatMYR(price) : "RM —"}
                    </dd>
                  </div>
                </dl>
                {source === "ai_document" && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-violet-500/8 px-2.5 py-2 text-xs text-violet-700 dark:text-violet-300">
                    <Sparkles className="size-3.5" /> Will be saved as an AI document import
                  </p>
                )}
                {tech && (
                  <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                    <Send className="mt-0.5 size-3.5 shrink-0" />
                    {tech.name.split(/\s+/)[0]} gets a ready-to-send WhatsApp job card once saved.
                  </p>
                )}
                <div className="space-y-1.5">
                  <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                    <span>Required details</span>
                    <span className="tabular">
                      {filledCount}/{REQUIRED.length}
                    </span>
                  </div>
                  <div className="bg-muted h-1 overflow-hidden rounded-full">
                    <motion.div
                      className="bg-gradient-brand h-full origin-left rounded-full"
                      initial={false}
                      animate={{ scaleX: filledCount / REQUIRED.length }}
                      transition={{ duration: 0.4, ease: EASE }}
                    />
                  </div>
                </div>
                <div className="hidden lg:block">
                  <Button type="submit" disabled={isSubmitting} className="shadow-brand/25 h-10 w-full text-sm shadow-md">
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <FilePlus2 />}
                    {isSubmitting ? "Creating order…" : values.technicianId ? "Create & assign order" : "Create order"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </aside>

          {/* Phones/tablets: the submit stays under the thumb while scrolling the form */}
          <div className="bg-background/90 sticky bottom-0 z-20 -mx-4 -mb-6 flex items-center gap-3 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.15)] backdrop-blur-md lg:hidden">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-[11px]">
                Quoted · <span className="tabular">{filledCount}/{REQUIRED.length}</span> required
              </p>
              <p className="truncate text-base font-semibold tabular">
                {values.quotedPrice && Number.isFinite(price) ? formatMYR(price) : "RM —"}
              </p>
            </div>
            <Button type="submit" disabled={isSubmitting} className="shadow-brand/25 h-11 shrink-0 px-4 text-sm shadow-md">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <FilePlus2 />}
              {isSubmitting ? "Creating…" : values.technicianId ? "Create & assign" : "Create order"}
            </Button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
