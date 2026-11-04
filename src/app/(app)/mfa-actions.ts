"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MFA_FACTOR_NAME, MFA_ISSUER, OTP_PATTERN, auditMfa, mfaErrorMessage, verifiedTotpFactor, type MfaStatus } from "@/lib/mfa";

// Self-service two-factor authentication, opened from the user menu. Every action runs as the
// signed-in user (their own session), so nobody can change another person's 2FA here.

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface MfaEnrollment {
  factorId: string;
  /** SVG data URL of the otpauth:// QR code. */
  qrCode: string;
  /** Base32 secret for manual entry. */
  secret: string;
}

export async function getMfaStatus(): Promise<MfaStatus> {
  await requireUser();
  const factor = await verifiedTotpFactor(await createClient());
  return { enabled: !!factor, enabledAt: factor?.updated_at ?? factor?.created_at ?? null };
}

/** Starts setup: a new, unconfirmed authenticator factor with its QR code. */
export async function startMfaEnrollment(): Promise<Result<{ enrollment: MfaEnrollment }>> {
  await requireUser();
  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, error: "Could not start setup. Try again." };
  if (factors.totp.some((f) => f.status === "verified")) return { ok: false, error: "Two-factor authentication is already on." };

  // Drop setups that were started but never confirmed (names must be unique per user).
  for (const f of factors.all) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: MFA_FACTOR_NAME, issuer: MFA_ISSUER });
  if (error) return { ok: false, error: "Could not start setup. Try again." };
  const qr = data.totp.qr_code;
  return {
    ok: true,
    enrollment: {
      factorId: data.id,
      qrCode: qr.startsWith("data:") ? qr : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`,
      secret: data.totp.secret,
    },
  };
}

/** Confirms setup with the first code from the app. The session is upgraded to aal2. */
export async function confirmMfaEnrollment(factorId: string, code: string): Promise<Result> {
  const user = await requireUser();
  if (!OTP_PATTERN.test(code)) return { ok: false, error: "Enter the 6-digit code from your app." };
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { ok: false, error: mfaErrorMessage(error) };

  await auditMfa("mfa_enabled", { id: user.id, name: user.fullName }, { id: user.id, name: user.fullName, email: user.email });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Abandons a setup that was never confirmed. */
export async function cancelMfaEnrollment(factorId: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const pending = data?.all.find((f) => f.id === factorId && f.status === "unverified");
  if (pending) await supabase.auth.mfa.unenroll({ factorId });
}

/** Turns 2FA off. Requires a current code, so a borrowed unlocked laptop can't do it. */
export async function disableMfa(code: string): Promise<Result> {
  const user = await requireUser();
  if (!OTP_PATTERN.test(code)) return { ok: false, error: "Enter the 6-digit code from your app." };
  const supabase = await createClient();
  const factor = await verifiedTotpFactor(supabase);
  if (!factor) return { ok: false, error: "Two-factor authentication is already off." };

  const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (verifyError) return { ok: false, error: mfaErrorMessage(verifyError) };
  const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
  if (error) return { ok: false, error: "Could not turn it off. Try again." };

  await auditMfa("mfa_disabled", { id: user.id, name: user.fullName }, { id: user.id, name: user.fullName, email: user.email });
  revalidatePath("/", "layout");
  return { ok: true };
}
