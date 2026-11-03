import { createClient } from "@/lib/supabase/server";
import { extractOrderDocument } from "@/lib/ai/extract";
import { checkUpload, EXTRACT_MAX_BYTES } from "@/lib/ai/files";
import { authorizeApi, jsonError } from "@/lib/ai/http";
import type { ExtractApiResponse } from "@/lib/ai/types";

export const runtime = "nodejs";
export const maxDuration = 90;

/** POST /api/ai/extract — AI Document Understanding (admin). multipart/form-data `file`. */
export async function POST(request: Request) {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > EXTRACT_MAX_BYTES + 64 * 1024) return jsonError(413, "The file is larger than 10 MB.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "Expected multipart/form-data with a `file` field.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "Attach a file in the `file` field.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(bytes);
  if (!check.ok) return jsonError(check.status, check.error);

  const supabase = await createClient();
  const { data: services, error } = await supabase.from("service_types").select("code, name").eq("active", true).order("id");
  if (error) return jsonError(500, "Could not load service types.");

  const result = await extractOrderDocument({
    base64: Buffer.from(bytes).toString("base64"),
    mediaType: check.mediaType,
    fileName: file.name.slice(0, 200) || "document",
    sizeBytes: bytes.length,
    serviceTypes: (services ?? []) as { code: string; name: string }[],
    userId: auth.user.id,
  });

  const body: ExtractApiResponse = result;
  return Response.json(body, { status: result.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
}
