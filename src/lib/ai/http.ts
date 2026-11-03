import "server-only";
import { getSessionUser } from "@/lib/auth";
import type { AppRole, SessionUser } from "@/lib/types";

export function jsonError(status: number, error: string, headers?: HeadersInit) {
  return Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * Route-handler equivalent of `requireUser`: same session + role semantics, but answers
 * with 401/403 JSON instead of redirecting (API clients cannot follow a login redirect).
 */
export async function authorizeApi(roles: AppRole[]): Promise<{ user: SessionUser } | { response: Response }> {
  const user = await getSessionUser();
  if (!user) return { response: jsonError(401, "You need to sign in to use this feature.") };
  if (!roles.includes(user.role)) return { response: jsonError(403, "Your role does not have access to this AI feature.") };
  return { user };
}
