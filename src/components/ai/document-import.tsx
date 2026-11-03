"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileText, FileUp, Loader2, ScanText, Sparkles, Upload, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EASE } from "@/components/motion";
import type { ExtractedField, ExtractedOrderFields } from "@/lib/ai/contracts";
import { EXTRACT_MAX_BYTES, EXTRACT_MIME_TYPES } from "@/lib/ai/files";
import type { ExtractApiResponse } from "@/lib/ai/types";
import { formatBytes, formatMYR } from "@/lib/format";
import { cn } from "@/lib/utils";

const SAMPLE_URL = "/samples/sample-job-sheet.pdf";
const SCAN_STEPS = ["Detecting document layout", "Reading customer details", "Matching service type", "Checking amounts and dates"];

type Phase = "idle" | "scanning" | "done" | "error";

const FIELD_ROWS: { key: keyof Omit<ExtractedOrderFields, "documentType" | "summary">; label: string }[] = [
  { key: "customerName", label: "Customer" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "serviceTypeCode", label: "Service type" },
  { key: "serviceDetails", label: "Problem / work" },
  { key: "amount", label: "Amount" },
  { key: "date", label: "Date" },
];

function fieldText(key: string, field: ExtractedField<string> | ExtractedField<number>) {
  if (field.value === null || field.value === "") return null;
  if (key === "amount" && typeof field.value === "number") return formatMYR(field.value);
  return String(field.value);
}

function ConfidenceBar({ value, delay }: { value: number; delay: number }) {
  const pct = Math.round(value * 100);
  const tone = value >= 0.8 ? "bg-success" : value >= 0.5 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2" title={`${pct}% confidence`}>
      <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
        <motion.div
          className={cn("h-full rounded-full", tone)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: EASE, delay }}
        />
      </div>
      <span className="text-muted-foreground tabular w-8 text-right text-[11px]">{pct}%</span>
    </div>
  );
}

function ScanOverlay({ step }: { step: number }) {
  return (
    <>
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-16"
        style={{ background: "linear-gradient(180deg, transparent, color-mix(in oklch, var(--brand) 22%, transparent))" }}
        initial={{ top: "-15%" }}
        animate={{ top: ["-15%", "100%"] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}
      >
        <div className="bg-brand absolute inset-x-0 bottom-0 h-0.5 shadow-[0_0_14px_2px] shadow-brand/70" />
      </motion.div>
      <div className="absolute inset-x-0 bottom-0 flex justify-center p-3">
        <AnimatePresence mode="wait">
          <motion.span
            key={step}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="bg-background/90 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur"
          >
            <Loader2 className="text-primary size-3 animate-spin" />
            {SCAN_STEPS[step % SCAN_STEPS.length]}…
          </motion.span>
        </AnimatePresence>
      </div>
    </>
  );
}

/** AI Document Understanding: upload a quotation / job sheet / invoice and prefill the order form. */
export function DocumentImportButton({ onExtracted, className }: { onExtracted: (fields: ExtractedOrderFields) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ExtractedOrderFields | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [loadingSample, setLoadingSample] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);

  // Rotate the scanning captions while a request is in flight.
  useEffect(() => {
    if (phase !== "scanning") return;
    const timer = setInterval(() => setScanStep((s) => s + 1), 1400);
    return () => clearInterval(timer);
  }, [phase]);

  // Release the preview object URL and any in-flight request on unmount.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  function setPreview(next: File | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next && next.type.startsWith("image/") ? URL.createObjectURL(next) : null;
    setPreviewUrl(urlRef.current);
  }

  function resetAll() {
    abortRef.current?.abort();
    setFile(null);
    setPreview(null);
    setPhase("idle");
    setResult(null);
    setError(null);
    setScanStep(0);
  }

  function selectFile(next: File | undefined | null) {
    if (!next) return;
    const byExtension = /\.(pdf|png|jpe?g|webp)$/i.test(next.name);
    if (!(EXTRACT_MIME_TYPES as readonly string[]).includes(next.type) && !(next.type === "" && byExtension)) {
      setError("Unsupported file type. Upload a PDF, PNG, JPEG or WebP.");
      setPhase("error");
      return;
    }
    if (next.size > EXTRACT_MAX_BYTES) {
      setError("The file is larger than 10 MB.");
      setPhase("error");
      return;
    }
    setFile(next);
    setPreview(next);
    setResult(null);
    setError(null);
    setPhase("idle");
  }

  async function trySample() {
    setLoadingSample(true);
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      selectFile(new File([blob], "sample-job-sheet.pdf", { type: "application/pdf" }));
    } catch {
      toast.error("Could not load the sample document");
    } finally {
      setLoadingSample(false);
    }
  }

  async function extract() {
    if (!file) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase("scanning");
    setScanStep(0);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/ai/extract", { method: "POST", body: form, signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as ExtractApiResponse | null;
      if (!body) throw new Error(`The extraction service is unavailable (HTTP ${res.status}).`);
      if (!body.ok) throw new Error(body.error);
      setResult(body.fields);
      setPhase("done");
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Extraction failed.");
      setPhase("error");
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }

  function apply() {
    if (!result) return;
    onExtracted(result);
    toast.success("Fields applied", { description: "Review the prefilled order before saving." });
    setOpen(false);
    resetAll();
  }

  const found = result ? FIELD_ROWS.filter((r) => result[r.key].value !== null).length : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetAll();
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" className={cn("gap-1.5", className)} />}>
        <Sparkles className="text-primary" />
        Import from document
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2">
            <span className="bg-gradient-brand flex size-6 items-center justify-center rounded-md text-white">
              <ScanText className="size-3.5" />
            </span>
            AI document import
          </DialogTitle>
          <DialogDescription>
            Upload a quotation, job sheet or invoice. Claude reads it and proposes order fields with a confidence score for each.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.1fr]">
          {/* Left: drop zone / preview */}
          <div>
            <input
              ref={inputRef}
              type="file"
              accept={EXTRACT_MIME_TYPES.join(",")}
              className="sr-only"
              onChange={(e) => {
                selectFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {!file ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  selectFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
                  dragging ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/40",
                )}
              >
                <motion.span
                  animate={dragging ? { y: -4, scale: 1.05 } : { y: 0, scale: 1 }}
                  className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full"
                >
                  <Upload className="size-5" />
                </motion.span>
                <span className="text-sm font-medium">Drop a document here</span>
                <span className="text-muted-foreground text-xs">or click to browse · PDF, PNG, JPEG, WebP · max 10 MB</span>
              </button>
            ) : (
              <div className="bg-muted/40 relative aspect-[4/5] w-full overflow-hidden rounded-xl border">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                  <img src={previewUrl} alt={`Preview of ${file.name}`} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
                    <div className="bg-background w-3/4 space-y-2 rounded-lg border p-4 shadow-sm">
                      <FileText className="text-primary size-6" />
                      {[90, 70, 80, 55, 75, 40].map((w, i) => (
                        <div key={i} className="bg-muted h-1.5 rounded-full" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  </div>
                )}
                {phase === "scanning" && <ScanOverlay step={scanStep} />}
                {phase !== "scanning" && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-xs"
                    className="absolute top-2 right-2"
                    onClick={resetAll}
                    aria-label="Remove file"
                  >
                    <X />
                  </Button>
                )}
              </div>
            )}
            {file && (
              <p className="text-muted-foreground mt-2 truncate text-xs">
                <FileUp className="mr-1 inline size-3" />
                {file.name} · {formatBytes(file.size)}
              </p>
            )}
          </div>

          {/* Right: status / results */}
          <div className="flex min-h-0 flex-col">
            <AnimatePresence mode="wait">
              {phase === "done" && result ? (
                <motion.div key="result" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div className="bg-success/8 border-success/25 flex items-start gap-2 rounded-lg border px-3 py-2">
                    <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 text-xs">
                      <p className="font-medium capitalize">
                        {result.documentType.replace(/_/g, " ")} · {found} of {FIELD_ROWS.length} fields found
                      </p>
                      <p className="text-muted-foreground">{result.summary}</p>
                    </div>
                  </div>
                  <ul className="divide-y rounded-lg border">
                    {FIELD_ROWS.map((row, i) => {
                      const field = result[row.key];
                      const text = fieldText(row.key, field);
                      return (
                        <motion.li
                          key={row.key}
                          initial={{ opacity: 0, x: 6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, ease: EASE, delay: i * 0.05 }}
                          className="flex items-start gap-3 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-muted-foreground text-[11px]">{row.label}</p>
                            <p className={cn("text-sm break-words", !text && "text-muted-foreground italic")}>{text ?? "Not found"}</p>
                          </div>
                          {text && <ConfidenceBar value={field.confidence} delay={0.15 + i * 0.05} />}
                        </motion.li>
                      );
                    })}
                  </ul>
                </motion.div>
              ) : phase === "error" ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              ) : phase === "scanning" ? (
                <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2.5">
                  {FIELD_ROWS.map((row, i) => (
                    <div key={row.key} className="space-y-1">
                      <p className="text-muted-foreground text-[11px]">{row.label}</p>
                      <div className="bg-muted/70 shimmer h-4 rounded" style={{ width: `${55 + ((i * 17) % 40)}%`, animationDelay: `${i * 0.1}s` }} />
                    </div>
                  ))}
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-muted-foreground space-y-3 text-sm">
                  <p className="text-foreground font-medium">What gets extracted</p>
                  <ul className="space-y-1.5 text-xs">
                    <li>• Customer name, phone and address</li>
                    <li>• Service type, matched to your live service catalogue</li>
                    <li>• Problem description / requested work</li>
                    <li>• Quoted amount (MYR) and appointment date</li>
                  </ul>
                  <p className="text-xs">Nothing is saved until you apply the fields and submit the order. Every extraction is logged for audit.</p>
                  {!file && (
                    <Button type="button" variant="outline" size="sm" onClick={trySample} disabled={loadingSample}>
                      {loadingSample ? <Loader2 className="animate-spin" /> : <FileText />}
                      Try a sample job sheet
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0">
          {phase === "done" ? (
            <>
              <Button type="button" variant="outline" onClick={resetAll}>
                Start over
              </Button>
              <Button type="button" onClick={apply} className="bg-gradient-brand text-white">
                <Wand2 /> Apply to form
              </Button>
            </>
          ) : (
            <Button type="button" onClick={extract} disabled={!file || phase === "scanning"} className="bg-gradient-brand text-white">
              {phase === "scanning" ? <Loader2 className="animate-spin" /> : <ScanText />}
              {phase === "scanning" ? "Reading document…" : phase === "error" && file ? "Try again" : "Extract fields"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
