"use client";

import { useActionState, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BarChart3, Check, ClipboardList, Eye, EyeOff, Lock, Mail, ShieldCheck, Snowflake, Wrench } from "lucide-react";
import { toast } from "sonner";
import { EASE } from "@/components/motion";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/lib/demo";
import type { AppRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { demoLoginAction, loginAction, type LoginState } from "./actions";

const ROLE_STYLE: Record<AppRole, { gradient: string; glow: string; chip: string; icon: typeof Wrench }> = {
  admin: { gradient: "from-sky-300 to-blue-600", glow: "group-hover:shadow-sky-500/20", chip: "Admin", icon: ClipboardList },
  technician: { gradient: "from-teal-200 to-cyan-600", glow: "group-hover:shadow-cyan-500/20", chip: "Field", icon: Wrench },
  manager: { gradient: "from-indigo-300 to-violet-600", glow: "group-hover:shadow-violet-500/20", chip: "Manager", icon: BarChart3 },
};
const PRIMARY = ["admin", "ali", "manager"];
const PRIMARY_DEMOS = DEMO_ACCOUNTS.filter((a) => PRIMARY.includes(a.key));
const OTHER_TECHS = DEMO_ACCOUNTS.filter((a) => !PRIMARY.includes(a.key));

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

type Tab = "demo" | "email";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [demoPending, startDemo] = useTransition();
  const [activeDemo, setActiveDemo] = useState<DemoAccount | null>(null);
  const [tab, setTab] = useState<Tab>("demo");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");

  function demo(account: DemoAccount) {
    setActiveDemo(account);
    startDemo(async () => {
      const res = await demoLoginAction(account.key);
      if (res?.error) {
        toast.error(res.error);
        setActiveDemo(null);
      }
    });
  }

  const signingIn = demoPending && activeDemo ? activeDemo : pending ? { fullName: email || "your account", role: null, title: "Email sign-in" } : null;

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
          <p className="mt-1 text-sm text-white/50">Sign in to the Sejuk Ops control room</p>
        </div>

        {/* Segmented control */}
        <div role="tablist" className="relative mt-7 grid [@media(max-height:780px)]:mt-5 grid-cols-2 rounded-xl border border-white/[0.08] bg-black/25 p-1 text-sm">
          {(
            [
              ["demo", "Instant demo"],
              ["email", "Email & password"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "relative h-9 rounded-lg font-medium transition-colors duration-300",
                tab === key ? "text-white" : "text-white/45 hover:text-white/75",
              )}
            >
              {tab === key && (
                <motion.span
                  layoutId="login-tab"
                  className="absolute inset-0 rounded-lg border border-white/10 bg-white/[0.08] shadow-sm"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>

        {/* Panels */}
        <div className="relative mt-5 min-h-[288px] [@media(max-height:780px)]:mt-4 [@media(max-height:780px)]:min-h-[276px]">
          <AnimatePresence mode="wait" initial={false}>
            {tab === "demo" ? (
              <motion.div
                key="demo"
                initial={{ opacity: 0, x: -14, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: -14, filter: "blur(4px)" }}
                transition={{ duration: 0.35, ease: EASE }}
                className="space-y-2.5"
              >
                {PRIMARY_DEMOS.map((a, i) => {
                  const style = ROLE_STYLE[a.role];
                  const Icon = style.icon;
                  return (
                    <motion.button
                      key={a.key}
                      type="button"
                      disabled={demoPending}
                      onClick={() => demo(a)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: EASE, delay: 0.45 + i * 0.08 }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.985 }}
                      className={cn(
                        "group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-left shadow-lg shadow-transparent transition-[border-color,background-color,box-shadow] duration-300 hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-60",
                        style.glow,
                      )}
                    >
                      <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent opacity-0 transition-all duration-700 group-hover:left-full group-hover:opacity-100" />
                      <span
                        className={cn(
                          "relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-semibold text-slate-950",
                          style.gradient,
                        )}
                      >
                        {initials(a.fullName)}
                        <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-md border border-white/10 bg-slate-900 text-white/80">
                          <Icon className="size-3" />
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[14.5px] font-medium text-white">{a.fullName}</span>
                          <span className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-px text-[10px] font-medium tracking-wide text-white/55 uppercase">
                            {style.chip}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-white/45">{a.blurb}</span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-white/30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-white" />
                    </motion.button>
                  );
                })}

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.75 }}
                  className="flex flex-wrap items-center gap-1.5 pt-2 text-xs text-white/40"
                >
                  <span className="mr-1">Other technicians</span>
                  {OTHER_TECHS.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      disabled={demoPending}
                      onClick={() => demo(a)}
                      title={a.title}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-white/65 transition-colors hover:border-cyan-300/40 hover:text-white disabled:opacity-50"
                    >
                      {a.fullName.split(" ")[0]}
                    </button>
                  ))}
                </motion.div>
              </motion.div>
            ) : (
              <motion.form
                key="email"
                action={formAction}
                onSubmit={(e) => setEmail(String(new FormData(e.currentTarget).get("email") ?? ""))}
                initial={{ opacity: 0, x: 14, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: 14, filter: "blur(4px)" }}
                transition={{ duration: 0.35, ease: EASE }}
                className="space-y-4"
              >
                <input type="hidden" name="next" value={next ?? ""} />
                <Field label="Work email" htmlFor="email" icon={Mail}>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@sejuk.demo"
                    required
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

                <AnimatePresence>
                  {state.error && !pending && (
                    <motion.p
                      initial={{ opacity: 0, height: 0, y: -4 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                    >
                      {state.error}
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
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="relative mt-6 flex items-center justify-center gap-2 border-t border-white/[0.07] pt-5 text-[11.5px] whitespace-nowrap text-white/40 [@media(max-height:780px)]:mt-4 [@media(max-height:780px)]:pt-4">
          <ShieldCheck className="size-3.5 text-emerald-300/80" />
          Supabase Auth · Row-level security · Audited
        </div>

        {/* Signing-in overlay */}
        <AnimatePresence>{signingIn && <SigningIn account={signingIn} />}</AnimatePresence>
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

const STEPS = ["Authenticating with Supabase", "Applying role permissions (RLS)", "Preparing your workspace"];

function SigningIn({ account }: { account: { fullName: string; role: AppRole | null; title: string } }) {
  const gradient = account.role ? ROLE_STYLE[account.role].gradient : "from-sky-300 to-cyan-500";
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
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-full bg-gradient-to-br text-lg font-semibold text-slate-950",
            gradient,
          )}
        >
          {account.role ? initials(account.fullName) : <Lock className="size-5" />}
        </span>
      </motion.div>
      <p className="mt-5 text-base font-medium text-white">Signing in as {account.fullName}</p>
      <p className="text-sm text-white/45">{account.title}</p>
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
