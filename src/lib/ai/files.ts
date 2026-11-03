/** Upload helpers shared by the extraction endpoints. Pure (unit-tested). */

export const EXTRACT_MAX_BYTES = 10 * 1024 * 1024;
export const EXTRACT_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
export type ExtractMimeType = (typeof EXTRACT_MIME_TYPES)[number];

/**
 * Detect the real file type from its magic bytes — the browser-supplied MIME type is
 * client-controlled and never trusted on its own.
 */
export function sniffMime(bytes: Uint8Array): ExtractMimeType | null {
  const at = (i: number) => bytes[i];
  const ascii = (start: number, text: string) => [...text].every((ch, i) => at(start + i) === ch.charCodeAt(0));
  if (bytes.length >= 5 && ascii(0, "%PDF-")) return "application/pdf";
  if (bytes.length >= 8 && at(0) === 0x89 && ascii(1, "PNG") && at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a) return "image/png";
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  return null;
}

export type UploadCheck = { ok: true; mediaType: ExtractMimeType } | { ok: false; error: string; status: number };

/** Validate size and content type of an uploaded file's bytes. */
export function checkUpload(
  bytes: Uint8Array,
  opts: { allowed?: readonly ExtractMimeType[]; maxBytes?: number } = {},
): UploadCheck {
  const allowed = opts.allowed ?? EXTRACT_MIME_TYPES;
  const maxBytes = opts.maxBytes ?? EXTRACT_MAX_BYTES;
  if (bytes.length === 0) return { ok: false, error: "The file is empty.", status: 400 };
  if (bytes.length > maxBytes) return { ok: false, error: `The file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`, status: 413 };
  const mediaType = sniffMime(bytes);
  if (!mediaType || !allowed.includes(mediaType)) {
    const names = allowed.map((m) => m.split("/")[1]!.toUpperCase()).join(", ");
    return { ok: false, error: `Unsupported file. Upload one of: ${names}.`, status: 415 };
  }
  return { ok: true, mediaType };
}
