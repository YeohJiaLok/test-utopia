import "server-only";
import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Two-factor authentication (TOTP) helpers shared by the sign-in code step and the
 * "Two-factor authentication" panel. Supabase Auth stores the factors and checks codes;
 * Postgres enforces it (public.mfa_satisfied(), see *_mfa.sql).
 */

export const MFA_ISSUER = "Sejuk Ops";
export const MFA_FACTOR_NAME = "Authenticator app";
export const OTP_PATTERN = /^\d{6}$/;

export interface MfaStatus {
  enabled: boolean;
  /** When the authenticator was confirmed (ISO). */
  enabledAt: string | null;
}

/** The user's confirmed authenticator-app factor, if any. */
export async function verifiedTotpFactor(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error("Could not read your sign-in methods. Try again.");
  return data.totp.find((f) => f.status === "verified") ?? null;
}

/** Plain-language message for a failed code check. */
export function mfaErrorMessage(error: AuthError): string {
  if (error.status === 429 || error.code === "over_request_rate_limit") return "Too many attempts. Wait a minute and try again.";
  if (error.code === "mfa_challenge_expired") return "That code expired. Enter the newest code from your app.";
  if (error.code === "mfa_verification_failed" || error.code === "mfa_verification_rejected") {
    return "That code didn't match. Enter the newest code from your authenticator app.";
  }
  return "We couldn't check that code. Try again.";
}

/** Records a 2FA change in the user-admin audit trail (service role: users can't forge it). */
export async function auditMfa(
  action: "mfa_enabled" | "mfa_disabled" | "mfa_reset",
  actor: { id: string; name: string },
  target: { id: string; name: string; email: string | null },
) {
  const { error } = await createAdminClient().from("user_admin_events").insert({
    actor_id: actor.id,
    actor_name: actor.name,
    action,
    target_id: target.id,
    target_name: target.name,
    target_email: target.email,
    changes: { two_factor: { from: action === "mfa_enabled" ? "off" : "on", to: action === "mfa_enabled" ? "on" : "off" } },
  });
  if (error) console.error("user_admin_events insert failed:", error.message);
}
