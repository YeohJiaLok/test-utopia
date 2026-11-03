"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { extractReceipt } from "@/lib/ai/actions";
import type { ReceiptExtraction } from "@/lib/ai/contracts";
import { compressImage, deleteAttachment, uploadAttachment } from "./use-media-uploads";
import type { ExistingReceipt } from "./types";

export interface ReceiptState {
  status: "idle" | "uploading" | "done" | "error";
  id?: string;
  path?: string;
  previewUrl?: string | null;
  error?: string;
  ai: { status: "idle" | "reading" | "done"; result?: ReceiptExtraction };
}

/**
 * Receipt capture for the payment step: compress to JPEG → job-media/<orderId>/receipt-<uuid>.jpg
 * → order_attachments (kind 'receipt', not counted in the 6-file limit) → AI amount extraction.
 */
export function useReceipt({ orderId, userId, initial }: { orderId: string; userId: string; initial: ExistingReceipt | null }) {
  const [state, setState] = useState<ReceiptState>(() =>
    initial
      ? { status: "done", id: initial.id, path: initial.storagePath, previewUrl: initial.url, ai: { status: "idle" } }
      : { status: "idle", ai: { status: "idle" } },
  );
  const objectUrl = useRef<string | null>(null);

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  const capture = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Receipt must be a photo");
        return;
      }
      const previous = state.status === "done" && state.id ? { id: state.id, path: state.path } : null;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      const preview = URL.createObjectURL(file);
      objectUrl.current = preview;
      setState({ status: "uploading", previewUrl: preview, ai: { status: "idle" } });

      let jpeg: File;
      let saved: { id: string; path: string };
      try {
        jpeg = await compressImage(file, { toJpeg: true });
        saved = await uploadAttachment({
          orderId,
          userId,
          file: jpeg,
          kind: "receipt",
          fileName: file.name || "receipt.jpg",
          path: `${orderId}/receipt-${crypto.randomUUID()}.jpg`,
        });
      } catch (e) {
        setState({ status: "error", previewUrl: preview, error: e instanceof Error ? e.message : "Upload failed", ai: { status: "idle" } });
        return;
      }

      // Replacing a receipt: tidy up the old one (best effort).
      if (previous) void deleteAttachment(previous.id, previous.path).catch(() => undefined);

      setState({ status: "done", id: saved.id, path: saved.path, previewUrl: preview, ai: { status: "reading" } });

      try {
        const fd = new FormData();
        fd.append("file", jpeg, "receipt.jpg");
        fd.append("orderId", orderId);
        fd.append("storagePath", saved.path);
        const result = await extractReceipt(fd);
        setState((s) => (s.path === saved.path ? { ...s, ai: { status: "done", result } } : s));
      } catch {
        setState((s) =>
          s.path === saved.path
            ? {
                ...s,
                ai: {
                  status: "done",
                  result: { ok: false, amount: null, date: null, merchant: null, paymentMethodHint: null, confidence: 0 },
                },
              }
            : s,
        );
      }
    },
    [orderId, userId, state],
  );

  const clear = useCallback(async () => {
    const current = state;
    if (current.status === "done" && current.id) {
      try {
        await deleteAttachment(current.id, current.path);
      } catch (e) {
        toast.error("Couldn't remove the receipt", { description: e instanceof Error ? e.message : undefined });
        return;
      }
    }
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
    setState({ status: "idle", ai: { status: "idle" } });
  }, [state]);

  return { receipt: state, capture, clear };
}
