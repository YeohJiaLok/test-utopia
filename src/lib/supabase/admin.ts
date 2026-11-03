import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — use ONLY for system writes that users must not
 * be able to forge (AI governance log, AI flags, cached insights) and for admin user
 * management (auth accounts + profiles, admin-only and audited). Never for user reads.
 */
export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl(), serverEnv.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
