"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileText, ImageOff, PlayCircle, X } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { AttachmentWithUrl } from "@/lib/data/orders";
import { cn } from "@/lib/utils";

/** Grid of job photos / videos / PDFs with an animated lightbox. */
export function AttachmentGallery({ attachments, className }: { attachments: AttachmentWithUrl[]; className?: string }) {
  const [open, setOpen] = useState<AttachmentWithUrl | null>(null);
  const media = attachments.filter((a) => a.kind !== "receipt");

  if (!media.length) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm">
        <ImageOff className="size-4" /> No photos, videos or documents uploaded.
      </div>
    );
  }

  return (
    <>
      <div className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6", className)}>
        {media.map((a, i) => (
          <motion.button
            key={a.id}
            type="button"
            layoutId={`att-${a.id}`}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => (a.kind === "pdf" && a.url ? window.open(a.url, "_blank") : setOpen(a))}
            className="group bg-muted relative aspect-square overflow-hidden rounded-lg border text-left"
          >
            {a.kind === "photo" && a.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt={a.file_name} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
            ) : a.kind === "video" ? (
              <div className="flex size-full flex-col items-center justify-center gap-1">
                <PlayCircle className="text-primary size-7" />
                <span className="text-muted-foreground px-1 text-[10px]">Video</span>
              </div>
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-1">
                <FileText className="text-primary size-7" />
                <span className="text-muted-foreground line-clamp-1 px-1 text-[10px]">{a.file_name}</span>
              </div>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              {formatBytes(a.size_bytes)}
            </span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
          >
            <button
              type="button"
              className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
            <motion.div layoutId={`att-${open.id}`} className="max-h-full max-w-4xl overflow-hidden rounded-xl" onClick={(e) => e.stopPropagation()}>
              {open.kind === "video" && open.url ? (
                <video src={open.url} controls autoPlay className="max-h-[85vh]" />
              ) : open.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={open.url} alt={open.file_name} className="max-h-[85vh] object-contain" />
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
