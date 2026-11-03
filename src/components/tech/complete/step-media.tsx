"use client";

import { useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Check, FileText, ImagePlus, Loader2, PlayCircle, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EASE } from "@/components/motion";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MAX_JOB_MEDIA } from "../lib";
import { StepError, StepIntro } from "./fields";
import type { MediaItem, useMediaUploads } from "./use-media-uploads";

type Media = ReturnType<typeof useMediaUploads>;

function StatusChip({ item, onRetry }: { item: MediaItem; onRetry: () => void }) {
  const base = "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold backdrop-blur-sm";
  switch (item.status) {
    case "compressing":
      return (
        <span className={cn(base, "bg-black/55 text-white")}>
          <Loader2 className="size-3 animate-spin" /> Optimising {Math.round(item.progress)}%
        </span>
      );
    case "uploading":
      return (
        <span className={cn(base, "bg-black/55 text-white")}>
          <Loader2 className="size-3 animate-spin" /> Uploading
        </span>
      );
    case "removing":
      return (
        <span className={cn(base, "bg-black/55 text-white")}>
          <Loader2 className="size-3 animate-spin" /> Removing
        </span>
      );
    case "error":
      return (
        <button type="button" onClick={onRetry} className={cn(base, "h-7 bg-red-600 px-2.5 text-white")}>
          <RotateCw className="size-3" /> Retry
        </button>
      );
    case "done":
      return (
        <span className={cn(base, "bg-emerald-600/90 text-white")}>
          <Check className="size-3" strokeWidth={3} /> Saved
        </span>
      );
  }
}

function Preview({ item }: { item: MediaItem }) {
  if (item.kind === "photo" && item.previewUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.previewUrl} alt={item.name} className="size-full object-cover" />;
  }
  if (item.kind === "video") {
    return (
      <div className="relative size-full bg-slate-900">
        {item.previewUrl && (
          <video src={item.previewUrl} muted playsInline preload="metadata" className="size-full object-cover opacity-80" />
        )}
        <PlayCircle className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow" />
      </div>
    );
  }
  return (
    <div className="flex size-full flex-col items-center justify-center gap-1 p-2">
      <FileText className="text-primary size-8" />
      <span className="text-muted-foreground line-clamp-2 text-center text-[10px] break-all">{item.name}</span>
    </div>
  );
}

export function StepMedia({ media, error }: { media: Media; error: string | null }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const used = MAX_JOB_MEDIA - media.remaining;
  const full = media.remaining === 0;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) media.addFiles(e.target.files);
    e.target.value = "";
  }

  return (
    <div className="space-y-5">
      <StepIntro
        title="Photos & documents"
        description="Before/after photos, short videos or PDFs. Photos are compressed on your phone to upload fast."
      />

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium tabular-nums">
            {used} of {MAX_JOB_MEDIA} added
          </span>
          <span className={cn("text-xs tabular-nums", full ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
            {full ? "Limit reached" : `${media.remaining} slot${media.remaining === 1 ? "" : "s"} left`}
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1" aria-hidden>
          {Array.from({ length: MAX_JOB_MEDIA }, (_, i) => (
            <span
              key={i}
              className={cn("h-1.5 rounded-full transition-colors duration-300", i < used ? "bg-primary" : "bg-border")}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={full}
          onClick={() => cameraRef.current?.click()}
          className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 h-14 flex-col gap-0.5 rounded-xl"
        >
          <Camera className="size-5" />
          <span className="text-xs">Camera</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={full}
          onClick={() => filesRef.current?.click()}
          className="h-14 flex-col gap-0.5 rounded-xl"
        >
          <ImagePlus className="size-5" />
          <span className="text-xs">Gallery / files</span>
        </Button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={onPick}
        />
        <input
          ref={filesRef}
          type="file"
          accept="image/*,video/*,application/pdf"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={onPick}
        />
      </div>

      {media.items.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          <AnimatePresence initial={false} mode="popLayout">
            {media.items.map((item) => {
              const working = item.status === "compressing" || item.status === "uploading" || item.status === "removing";
              return (
                <motion.li
                  key={item.key}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className={cn(
                    "bg-muted relative aspect-square overflow-hidden rounded-xl border",
                    item.status === "error" && "border-red-500/60",
                  )}
                >
                  <Preview item={item} />
                  {working && <div className="shimmer absolute inset-0 bg-black/20" aria-hidden />}
                  {item.status === "compressing" && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
                      <div className="bg-primary h-full transition-[width] duration-200" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                  <div className="absolute bottom-1.5 left-1.5">
                    <StatusChip item={item} onRetry={() => media.retry(item.key)} />
                  </div>
                  {item.removable && (item.status === "done" || item.status === "error") && (
                    <button
                      type="button"
                      onClick={() => void media.remove(item.key)}
                      aria-label={`Remove ${item.name}`}
                      className="absolute top-1 right-1 flex size-9 items-center justify-center"
                    >
                      <span className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                        <X className="size-4" />
                      </span>
                    </button>
                  )}
                  <span className="sr-only">
                    {item.name}, {formatBytes(item.size)}, {item.status}
                    {item.error ? `: ${item.error}` : ""}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
          <Camera className="size-6" />
          No files yet — photos of the finished work help the manager approve faster.
        </div>
      )}

      {media.items.some((i) => i.status === "error") && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {media.items.find((i) => i.status === "error")?.error ?? "Upload failed"} — tap Retry or remove the file.
        </p>
      )}

      <StepError message={error} />
    </div>
  );
}
