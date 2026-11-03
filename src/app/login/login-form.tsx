"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail, ShieldCheck, Snowflake, TriangleAlert } from "lucide-react";
import { EASE } from "@/components/motion";
import { cn } from "@/lib/utils";
import { loginAction, type LoginState } from "./actions";

/** Credentials-only sign-in. The server decides the portal from the account's role. */
export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Server error after a submit; otherwise the notice the page arrived with (e.g. deactivated).
  const banner = pending ? undefined : (state.error ?? (submitted ? undefined : notice));

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
      className="relative w-full max-w-[430px] rounded-[28px] shadow-[0_30px_120px_-20px_oklch(0.5_0.17_245/0.45)]"
    >
      <div className="beam-rim" />
      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.09] bg-[oklch(0.17_0.025_256/0.72)] p-7 backdrop-blur-2xl sm:p-8 [@media(max-height:780px)]:p-6">
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl" />

        {/* Header */}
        <div className="relative flex flex-col items-center text-center">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.35 }}
            className="relative flex size-12 items-center [@media(max-height:780px)]:size-10 justify-center rounded-2xl bg-gradient-to-br from-sky-300 via-cyan-300 to-teal-200 text-slate-950 shadow-[0_0_40px_oklch(0.8_0.12_210/0.55)]"
          >
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 24, repeat: Infinity, ease: "linear" }}>
              <Snowflake className="size-6" strokeWidth={2.2} />
            </motion.span>
          </motion.span>
          <h2 className="mt-5 text-[1.6rem] [@media(max-height:780px)]:mt-3 font-semibold tracking-tight text-white">Welcome back</h2>
          <p className="mt-1 text-sm text-white/50">Sign in with your work account</p>
        </div>

        <form
          action={formAction}
          onSubmit={(e) => {
            setEmail(String(new FormData(e.currentTarget).get("email") ?? ""));
            setSubmitted(true);
          }}
          className="relative mt-7 space-y-4 [@media(max-height:780px)]:mt-5"
        >
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="Work email" htmlFor="email" icon={Mail}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="name@company.com"
              defaultValue={email}
              required
              autoFocus
              className={INPUT}
            />
          </Field>
          <Field label="Password" htmlFor="password" icon={Lock}>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
              onBlur={() => setCapsLock(false)}
              className={cn(INPUT, "pr-11")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </Field>
          {capsLock && <p className="-mt-2 text-xs text-amber-200/80">Caps Lock is on</p>}

          <AnimatePresence>
            {banner && (
              <motion.p
                key={banner}
                role="alert"
                initial={{ opacity: 0, height: 0, y: -4 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {banner}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={pending}
            className="group relative h-11 w-full overflow-hidden rounded-xl bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-200 text-sm font-semibold text-slate-950 shadow-[0_10px_40px_-10px_oklch(0.75_0.14_215/0.7)] transition-[box-shadow,transform] duration-300 hover:shadow-[0_14px_50px_-8px_oklch(0.75_0.14_215/0.9)] active:scale-[0.99] disabled:opacity-70"
          >
            <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/50 blur-md transition-all duration-700 group-hover:left-[110%]" />
            <span className="relative flex items-center justify-center gap-2">
              Sign in
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
          </button>

          <p className="text-center text-xs text-white/40">Forgot your password or need an account? Ask your administrator.</p>
        </form>

        {/* Footer */}
        <div className="relative mt-6 flex items-center justify-center gap-2 border-t border-white/[0.07] pt-5 text-[11.5px] whitespace-nowrap text-white/40 [@media(max-height:780px)]:mt-4 [@media(max-height:780px)]:pt-4">
          <ShieldCheck className="size-3.5 text-emerald-300/80" />
          Supabase Auth · Row-level security · Audited
        </div>

        {/* Signing-in overlay */}
        <AnimatePresence>{pending && <SigningIn email={email} />}</AnimatePresence>
      </div>
    </motion.div>
  );
}

const INPUT =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-[15px] text-white outline-none transition-[border-color,box-shadow,background-color] duration-300 placeholder:text-white/25 hover:border-white/20 focus:border-cyan-300/60 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_oklch(0.8_0.12_210/0.12)]";

function Field({
  label,
  htmlFor,
  icon: Icon,
  children,
}: {
  label: string;
  htmlFor: string;
  icon: typeof Mail;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-white/60">
        {label}
      </label>
      <div className="group relative">
        <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/35 transition-colors group-focus-within:text-cyan-300" />
        {children}
      </div>
    </div>
  );
}

const STEPS = ["Verifying your credentials", "Checking your role and access", "Opening your portal"];

function SigningIn({ email }: { email: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[oklch(0.15_0.025_256/0.88)] px-8 backdrop-blur-xl"
      role="status"
      aria-live="polite"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="relative flex size-20 items-center justify-center"
      >
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-300 border-r-cyan-300/40"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />
        <span className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-cyan-500 text-slate-950">
          <Lock className="size-5" />
        </span>
      </motion.div>
      <p className="mt-5 text-base font-medium text-white">Signing in</p>
      <p className="max-w-full truncate text-sm text-white/45">{email}</p>
      <ul className="mt-6 w-full max-w-[260px] space-y-2.5">
        {STEPS.map((s, i) => (
          <motion.li
            key={s}
            initial={{ opacity: 0.25, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.55, duration: 0.4, ease: EASE }}
            className="flex items-center gap-2.5 text-[13px] text-white/75"
          >
            <span className="relative flex size-4 items-center justify-center rounded-full border border-white/15">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5 + i * 0.55, type: "spring", stiffness: 400, damping: 20 }}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-cyan-300 text-slate-950"
              >
                <Check className="size-2.5" strokeWidth={3.5} />
              </motion.span>
            </span>
            {s}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
