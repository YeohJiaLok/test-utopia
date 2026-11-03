import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ends the session and returns to the login page. requireUser() sends deactivated accounts
 * (or accounts without a profile) here, so they are signed out instead of bouncing between
 * /login and their portal on a still-valid token.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });

  const url = new URL("/login", request.url);
  const reason = request.nextUrl.searchParams.get("reason");
  if (reason === "deactivated") url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}
