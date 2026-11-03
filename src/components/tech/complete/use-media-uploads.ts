"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { MAX_JOB_MEDIA, MAX_UPLOAD_BYTES, attachmentKindFor, safeFileName } from "../lib";
import type { ExistingMedia } from "./types";

export type MediaStatus = "compressing" | "uploading" | "done" | "error" | "removing";

export interface MediaItem {
  key: string;
  kind: "photo" | "video" | "pdf";
  name: string;
  size: number;
  mime: string;
  previewUrl: string | null;
  status: MediaStatus;
  /** 0-100 while compressing */
  progress: number;
  attachmentId?: string;
  storagePath?: string;
  error?: string;
  file?: File;
  removable: boolean;
}

export const JOB_MEDIA_BUCKET = "job-media";
const COMPRESSIBLE = /^image\/(jpeg|png|webp)$/i;

/** Compress photos on-device (~1600px, ~0.8 quality) before upload. Falls back to the original file. */
export async function compressImage(
  file: File,
  opts: { onProgress?: (p: number) => void; toJpeg?: boolean } = {},
): Promise<File> {
  if (!COMPRESSIBLE.test(file.type) && !opts.toJpeg) return file;
  try {
    const out = await imageCompression(file, {
      maxWidthOrHeight: 1600,
      initialQuality: 0.8,
      maxSizeMB: 1.5,
      // Main-thread compression avoids fetching the worker script from a CDN on patchy mobile data.
      useWebWorker: false,
      fileType: opts.toJpeg ? "image/jpeg" : undefined,
      onProgress: opts.onProgress,
    });
    return opts.toJpeg || out.size < file.size ? out : file;
  } catch {
    return file;
  }
}

/** Upload a file to job-media and register it in order_attachments. Cleans up the object if the row is rejected. */
export async function uploadAttachment(p: {
  orderId: string;
  userId: string;
  file: File;
  path: string;
  kind: "photo" | "video" | "pdf" | "receipt";
  fileName: string;
}): Promise<{ id: string; path: string; mime: string }> {
  const supabase = createClient();
  const mime = p.file.type || "application/octet-stream";
  const up = await supabase.storage
    .from(JOB_MEDIA_BUCKET)
    .upload(p.path, p.file, { contentType: mime, upsert: false, cacheControl: "3600" });
  if (up.error) throw new Error(up.error.message || "Upload failed");

  const { data, error } = await supabase
    .from("order_attachments")
    .insert({
      order_id: p.orderId,
      kind: p.kind,
      storage_path: p.path,
      file_name: p.fileName.slice(0, 200),
      mime_type: mime,
      size_bytes: p.file.size,
      uploaded_by: p.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    await supabase.storage.from(JOB_MEDIA_BUCKET).remove([p.path]);
    throw new Error(error?.message ?? "Could not save the file");
  }
  return { id: data.id as string, path: p.path, mime };
}

/** Delete an attachment row (RLS: own uploads on open jobs) and then its storage object. */
export async function deleteAttachment(attachmentId: string, storagePath: string | undefined) {
  const supabase = createClient();
  const { data, error } = await supabase.from("order_attachments").delete().eq("id", attachmentId).select("id");
  if (error || !data?.length) throw new Error(error?.message ?? "You can only remove files you uploaded.");
  if (storagePath) await supabase.storage.from(JOB_MEDIA_BUCKET).remove([storagePath]);
}

/**
 * Direct-to-storage uploads for job media: compress → upload to job-media/<orderId>/<uuid>-<name>
 * → insert order_attachments row. RLS + the attachment-limit trigger enforce the same rules server-side.
 */
export function useMediaUploads({
  orderId,
  userId,
  initial,
}: {
  orderId: string;
  userId: string;
  initial: ExistingMedia[];
}) {
  const [items, setItems] = useState<MediaItem[]>(() =>
    initial.map((m) => ({
      key: m.id,
      kind: m.kind,
      name: m.fileName,
      size: m.sizeBytes,
      mime: m.mimeType,
      previewUrl: m.url,
      status: "done",
      progress: 100,
      attachmentId: m.id,
      storagePath: m.storagePath,
      removable: m.removable,
    })),
  );
  const objectUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const patch = useCallback((key: string, changes: Partial<MediaItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...changes } : it)));
  }, []);

  const process = useCallback(
    async (key: string, original: File, kind: MediaItem["kind"]) => {
      try {
        let file = original;
        if (kind === "photo") {
          patch(key, { status: "compressing", progress: 0, error: undefined });
          file = await compressImage(original, { onProgress: (p) => patch(key, { progress: p }) });
        }
        patch(key, { status: "uploading", progress: 100, size: file.size, error: undefined });
        const saved = await uploadAttachment({
          orderId,
          userId,
          file,
          kind,
          fileName: original.name,
          path: `${orderId}/${crypto.randomUUID()}-${safeFileName(original.name)}`,
        });
        patch(key, { status: "done", attachmentId: saved.id, storagePath: saved.path, mime: saved.mime });
      } catch (e) {
        patch(key, { status: "error", error: e instanceof Error ? e.message : "Upload failed" });
      }
    },
    [orderId, userId, patch],
  );

  const activeCount = items.filter((i) => i.status !== "error").length;
  const remaining = Math.max(0, MAX_JOB_MEDIA - activeCount);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const files = Array.from(list);
      if (!files.length) return;
      let slots = remaining;
      const accepted: MediaItem[] = [];
      let skippedType = 0;
      let skippedSize = 0;
      let skippedLimit = 0;

      for (const file of files) {
        const kind = attachmentKindFor(file.type);
        if (!kind) {
          skippedType++;
          continue;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          skippedSize++;
          continue;
        }
        if (slots <= 0) {
          skippedLimit++;
          continue;
        }
        slots--;
        let previewUrl: string | null = null;
        if (kind !== "pdf") {
          previewUrl = URL.createObjectURL(file);
          objectUrls.current.add(previewUrl);
        }
        accepted.push({
          key: crypto.randomUUID(),
          kind,
          name: file.name,
          size: file.size,
          mime: file.type,
          previewUrl,
          status: kind === "photo" ? "compressing" : "uploading",
          progress: 0,
          file,
          removable: true,
        });
      }

      if (skippedType) toast.error(`${skippedType} file(s) skipped`, { description: "Only photos, videos and PDFs are allowed." });
      if (skippedSize) toast.error(`${skippedSize} file(s) too large`, { description: "Each file must be under 50 MB." });
      if (skippedLimit) toast.warning("Limit reached", { description: `A job can have at most ${MAX_JOB_MEDIA} files.` });
      if (!accepted.length) return;

      setItems((prev) => [...prev, ...accepted]);
      for (const it of accepted) void process(it.key, it.file!, it.kind);
    },
    [remaining, process],
  );

  const retry = useCallback(
    (key: string) => {
      const it = items.find((i) => i.key === key);
      if (!it?.file) return;
      if (remaining <= 0) {
        toast.warning("Limit reached", { description: `Remove a file first — max ${MAX_JOB_MEDIA}.` });
        return;
      }
      void process(key, it.file, it.kind);
    },
    [items, remaining, process],
  );

  const remove = useCallback(
    async (key: string) => {
      const it = items.find((i) => i.key === key);
      if (!it) return;
      const drop = () => {
        if (it.previewUrl && objectUrls.current.has(it.previewUrl)) {
          URL.revokeObjectURL(it.previewUrl);
          objectUrls.current.delete(it.previewUrl);
        }
        setItems((prev) => prev.filter((i) => i.key !== key));
      };
      if (it.status !== "done" || !it.attachmentId) {
        drop();
        return;
      }
      patch(key, { status: "removing" });
      try {
        await deleteAttachment(it.attachmentId, it.storagePath);
        drop();
      } catch (e) {
        patch(key, { status: "done" });
        toast.error("Couldn't remove the file", { description: e instanceof Error ? e.message : undefined });
      }
    },
    [items, patch],
  );

  const busy = items.some((i) => i.status === "compressing" || i.status === "uploading" || i.status === "removing");
  const failed = items.filter((i) => i.status === "error").length;
  const done = items.filter((i) => i.status === "done");

  return { items, addFiles, remove, retry, remaining, busy, failed, done };
}
