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

  const isPublic = pathname === "/login" || pathname.startsWith("/api/health");
  const role = (claims?.app_metadata as { role?: Role } | undefined)?.role;

  if (!claims) {
    if (isPublic || pathname.startsWith("/api/")) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
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
