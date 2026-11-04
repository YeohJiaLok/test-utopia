"use client";

import { useActionState, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import { EASE } from "@/components/motion";
import { OtpInput } from "@/components/shared/otp-input";
import { initials } from "@/lib/format";
import { verifyMfaAction, type LoginState } from "../actions";

/** Second sign-in step: the 6-digit code from Google / Microsoft Authenticator. */
export function VerifyForm({ name, email, next }: { name: string; email: string; next?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [code, setCode] = useState("");
  const [state, formAction, pending] = useActionState<LoginState, FormData>(async (prev, fd) => {
    const res = await verifyMfaAction(prev, fd);
    if (res.error) setCode(""); // wrong code: clear for the next try
    return res;
  }, {});
  const error = pending ? undefined : state.error;

  function submitCode(value: string) {
    flushSync(() => setCode(value));
    formRef.current?.requestSubmit();
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.97, filter: "blur(8px)" }}
      animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.7, ease: EASE }}
      className="relative w-full max-w-[430px] rounded-[28px] shadow-[0_30px_120px_-20px_oklch(0.5_0.17_245/0.45)]"
    >
      <div className="beam-rim" />
      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.09] bg-[oklch(0.17_0.025_256/0.72)] p-7 backdrop-blur-2xl sm:p-8 [@media(max-height:780px)]:p-6">
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-emerald-400/15 blur-3xl" />

        <div className="relative flex flex-col items-center text-center">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.2 }}
            className="relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 via-teal-300 to-cyan-300 text-slate-950 shadow-[0_0_40px_oklch(0.8_0.14_170/0.5)] [@media(max-height:780px)]:size-10"
          >
            <ShieldCheck className="size-6" strokeWidth={2.2} />
          </motion.span>
          <h2 className="mt-5 text-[1.6rem] font-semibold tracking-tight text-white [@media(max-height:780px)]:mt-3">Two-step verification</h2>
          <p className="mt-1 text-sm text-white/50">Enter the 6-digit code from your authenticator app</p>

          <div className="mt-4 flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pr-3 pl-1">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-cyan-400 text-[10px] font-semibold text-slate-950">
              {initials(name || email)}
            </span>
            <span className="truncate text-xs text-white/70">{email}</span>
          </div>
        </div>

        <form ref={formRef} action={formAction} className="relative mt-7 space-y-5 [@media(max-height:780px)]:mt-5">
          <input type="hidden" name="next" value={next ?? ""} />
          <OtpInput
            name="code"
            value={code}
            onChange={setCode}
            onComplete={submitCode}
            disabled={pending}
            invalid={!!error}
            autoFocus
            aria-label="6-digit authentication code"
            cellClassName="h-13 rounded-xl border-white/10 bg-white/[0.04] text-white text-2xl"
            activeCellClassName="border-cyan-300/70 bg-white/[0.07] shadow-[0_0_0_4px_oklch(0.8_0.12_210/0.15)]"
          />

          <AnimatePresence>
            {error && (
              <motion.p
                key={error}
                role="alert"
                initial={{ opacity: 0, height: 0, y: -4 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={pending || code.length !== 6}
            className="group relative h-11 w-full overflow-hidden rounded-xl bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-200 text-sm font-semibold text-slate-950 shadow-[0_10px_40px_-10px_oklch(0.75_0.14_215/0.7)] transition-[box-shadow,transform,opacity] duration-300 hover:shadow-[0_14px_50px_-8px_oklch(0.75_0.14_215/0.9)] active:scale-[0.99] disabled:opacity-60"
          >
            <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/50 blur-md transition-all duration-700 group-hover:left-[110%]" />
            <span className="relative flex items-center justify-center gap-2">
              {pending ? (
                <>
                  <motion.span
                    className="size-4 rounded-full border-2 border-slate-950/25 border-t-slate-950"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  />
                  Verifying
                </>
              ) : (
                <>
                  Verify and continue
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </>
              )}
            </span>
          </button>

          <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-left text-xs leading-relaxed text-white/45">
            <Smartphone className="mt-0.5 size-3.5 shrink-0 text-white/40" />
            <span>
              Open Google Authenticator or Microsoft Authenticator and find <span className="text-white/70">Sejuk Ops</span>. Lost
              your phone? Ask your administrator to reset two-factor authentication.
            </span>
          </div>
        </form>

        <div className="relative mt-6 flex items-center justify-center border-t border-white/[0.07] pt-5 [@media(max-height:780px)]:mt-4 [@media(max-height:780px)]:pt-4">
          {/* Plain link: the sign-out route ends this half-signed-in session. */}
          <a
            href="/auth/signout"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-white/45 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-3.5" /> Use a different account
          </a>
        </div>
      </div>
    </motion.div>
  );
}
