import { authorizeApi, jsonError } from "@/lib/ai/http";
import { getInsights } from "@/lib/ai/insights";

export const runtime = "nodejs";
export const maxDuration = 120;

async function handle(force: boolean) {
  const auth = await authorizeApi(["manager", "admin"]);
  if ("response" in auth) return auth.response;
  try {
    const payload = await getInsights(auth.user, { force });
    return Response.json({ ok: true, ...payload }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[ai] insights failed", err);
    return jsonError(500, "Could not compute this week's statistics. Please try again.");
  }
}

/** GET /api/ai/insights — weekly AI briefing (cached). */
export async function GET() {
  return handle(false);
}

/** POST /api/ai/insights — force a fresh briefing. */
export async function POST() {
  return handle(true);
}
