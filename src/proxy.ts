import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

type Role = "admin" | "technician" | "manager";

const HOME: Record<Role, string> = { admin: "/admin", technician: "/tech", manager: "/manager" };

// Optimistic, claim-based route guard. Authoritative checks live in the data access
// layer (requireUser) and in Postgres (RLS + workflow functions).
const ACCESS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/tech", roles: ["technician"] },
  { prefix: "/manager", roles: ["manager", "admin"] },
  { prefix: "/audit", roles: ["manager", "admin"] },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, claims } = await updateSession(request);

  // /login/verify is the 2FA code step: it checks the session itself (signed out → /login).
  const isPublic = pathname === "/login" || pathname === "/login/verify" || pathname === "/auth/signout" || pathname.startsWith("/api/health");
  // role + active are copied from public.profiles into app_metadata by the profiles_sync_claims trigger.
  const meta = claims?.app_metadata as { role?: Role; active?: boolean } | undefined;
  const role = meta?.role;

  if (!claims) {
    if (isPublic || pathname.startsWith("/api/")) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Deactivated account: end the session instead of opening any portal.
  if (meta?.active === false) {
    if (isPublic || pathname.startsWith("/api/")) return response;
    return NextResponse.redirect(new URL("/auth/signout?reason=deactivated", request.url));
  }

  if (pathname === "/" || pathname === "/login") {
    if (role) return NextResponse.redirect(new URL(HOME[role], request.url));
    return response;
  }

  const rule = ACCESS.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (rule && role && !rule.roles.includes(role)) {
    return NextResponse.redirect(new URL(HOME[role], request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|samples/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf)$).*)"],
};
