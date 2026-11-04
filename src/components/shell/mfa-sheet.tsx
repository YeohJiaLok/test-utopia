"use client";

import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Copy, KeyRound, Loader2, LockKeyhole, ScanLine, ShieldCheck, ShieldOff, Smartphone, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { OtpInput } from "@/components/shared/otp-input";
import { EASE } from "@/components/motion";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  cancelMfaEnrollment,
  confirmMfaEnrollment,
  disableMfa,
  getMfaStatus,
  startMfaEnrollment,
  type MfaEnrollment,
} from "@/app/(app)/mfa-actions";
import type { MfaStatus } from "@/lib/mfa";

type View =
  | { name: "loading" }
  | { name: "off" }
  | { name: "setup"; enrollment: MfaEnrollment }
  | { name: "done" }
  | { name: "on"; status: MfaStatus }
  | { name: "disable"; status: MfaStatus };

const APPS = ["Google Authenticator", "Microsoft Authenticator", "Any TOTP app"];

/**
 * Self-service two-factor authentication, opened from the user menu. Slides in from the
 * right; each step slides into the next.
 */
export function MfaSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [view, setView] = useState<View>({ name: "loading" });

  // Fresh status every time the panel opens.
  useEffect(() => {
    if (!open) return;
    let live = true;
    getMfaStatus()
      .then((s) => live && setView(s.enabled ? { name: "on", status: s } : { name: "off" }))
      .catch(() => live && setView({ name: "off" }));
    return () => {
      live = false;
    };
  }, [open]);

  function close(next: boolean) {
    if (!next) {
      // Closing mid-setup discards the unconfirmed authenticator.
      if (view.name === "setup") void cancelMfaEnrollment(view.enrollment.factorId);
      setTimeout(() => setView({ name: "loading" }), 500);
    }
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        side="right"
        className={cn(
          "gap-0 p-0 data-[side=right]:w-full sm:max-w-md data-[side=right]:sm:max-w-md",
          // Full glide in from the right edge (the default sheet only nudges 2.5rem).
          "duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] data-[side=right]:data-starting-style:translate-x-full data-[side=right]:data-ending-style:translate-x-full",
        )}
      >
        <SheetHeader className="border-b p-5 pr-12">
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="text-primary size-4.5" /> Two-factor authentication
          </SheetTitle>
          <SheetDescription>A code from your phone, on top of your password, every time you sign in.</SheetDescription>
        </SheetHeader>

        <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view.name}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.32, ease: EASE }}
              className="flex min-h-full flex-col p-5"
            >
              {view.name === "loading" && <LoadingView />}
              {view.name === "off" && <OffView onStarted={(enrollment) => setView({ name: "setup", enrollment })} />}
              {view.name === "setup" && (
                <SetupView
                  enrollment={view.enrollment}
                  onCancel={() => {
                    void cancelMfaEnrollment(view.enrollment.factorId);
                    setView({ name: "off" });
                  }}
                  onDone={() => setView({ name: "done" })}
                />
              )}
              {view.name === "done" && <DoneView onClose={() => close(false)} />}
              {view.name === "on" && <OnView status={view.status} onDisable={() => setView({ name: "disable", status: view.status })} />}
              {view.name === "disable" && (
                <DisableView
                  onCancel={() => setView({ name: "on", status: view.status })}
                  onDone={() => {
                    toast.success("Two-factor authentication is off");
                    setView({ name: "off" });
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ------------------------------------------------------------------ views --

function LoadingView() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

function StatusHero({ on }: { on: boolean }) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-4 overflow-hidden rounded-xl border p-4",
        on ? "border-success/25 bg-success/8" : "bg-muted/40",
      )}
    >
      <motion.span
        initial={{ scale: 0.7, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl",
          on ? "bg-success text-white shadow-success/30 shadow-lg" : "bg-gradient-brand shadow-brand/25 text-white shadow-lg",
        )}
      >
        {on ? <ShieldCheck className="size-6" /> : <LockKeyhole className="size-6" />}
      </motion.span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium">
          Two-factor authentication
          <span
            className={cn(
              "rounded-full px-2 py-px text-[11px] font-semibold",
              on ? "bg-success/15 text-success" : "bg-muted-foreground/15 text-muted-foreground",
            )}
          >
            {on ? "On" : "Off"}
          </span>
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {on ? "Your account asks for an authenticator code at sign-in." : "Only your password protects this account."}
        </p>
      </div>
    </div>
  );
}

function OffView({ onStarted }: { onStarted: (e: MfaEnrollment) => void }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-1 flex-col gap-5">
      <StatusHero on={false} />
      <ul className="space-y-3 text-sm">
        {[
          { icon: Smartphone, title: "Install an authenticator app", body: "Google Authenticator or Microsoft Authenticator, free on iPhone and Android." },
          { icon: ScanLine, title: "Scan one QR code", body: "Takes under a minute. The app then shows a new 6-digit code every 30 seconds." },
          { icon: KeyRound, title: "Enter the code when you sign in", body: "Even someone with your password can't get in without your phone." },
        ].map(({ icon: Icon, title, body }, i) => (
          <motion.li
            key={title}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.06, duration: 0.3, ease: EASE }}
            className="flex gap-3"
          >
            <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-4" />
            </span>
            <span>
              <span className="block font-medium">{title}</span>
              <span className="text-muted-foreground text-xs leading-relaxed">{body}</span>
            </span>
          </motion.li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-1.5">
        {APPS.map((a) => (
          <span key={a} className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-[11px] font-medium">
            {a}
          </span>
        ))}
      </div>
      <div className="mt-auto pt-2">
        <Button
          className="shadow-brand/25 h-11 w-full shadow-md"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await startMfaEnrollment();
              if (res.ok) onStarted(res.enrollment);
              else toast.error(res.error);
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Set up authenticator
        </Button>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="relative pl-10">
      <span className="bg-primary text-primary-foreground absolute top-0 left-0 flex size-7 items-center justify-center rounded-full text-xs font-semibold">
        {n}
      </span>
      <h3 className="pt-1 text-sm font-medium">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SetupView({ enrollment, onCancel, onDone }: { enrollment: MfaEnrollment; onCancel: () => void; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [pending, start] = useTransition();
  const groupedKey = enrollment.secret.replace(/(.{4})/g, "$1 ").trim();

  function submit(value = code) {
    if (value.length !== 6) return;
    setError(null);
    start(async () => {
      const res = await confirmMfaEnrollment(enrollment.factorId, value);
      if (res.ok) onDone();
      else {
        setError(res.error);
        setCode("");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Step n={1} title="Scan this QR code with your authenticator app">
        <div className="flex flex-col items-center gap-3">
          {/* Always white behind the code so phone cameras read it in dark mode too. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
            className="relative overflow-hidden rounded-2xl border bg-white p-3 shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL from Supabase Auth */}
            <img src={enrollment.qrCode} alt="QR code for your authenticator app" width={184} height={184} className="size-46" />
            <motion.span
              aria-hidden
              className="bg-primary/60 pointer-events-none absolute inset-x-3 h-0.5 rounded-full shadow-[0_0_12px_var(--color-primary)]"
              initial={{ top: "12%" }}
              animate={{ top: ["12%", "88%", "12%"] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
          <p className="text-muted-foreground text-center text-xs">
            In the app tap <span className="text-foreground font-medium">+</span> then{" "}
            <span className="text-foreground font-medium">Scan a QR code</span>. It appears as{" "}
            <span className="text-foreground font-medium">Sejuk Ops</span>.
          </p>
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="text-primary flex items-center gap-1 text-xs font-medium hover:underline"
            aria-expanded={showKey}
          >
            Can&apos;t scan it? Enter a setup key <ChevronDown className={cn("size-3.5 transition-transform", showKey && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {showKey && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="w-full overflow-hidden"
              >
                <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2 pl-3">
                  <code className="min-w-0 flex-1 font-mono text-[13px] tracking-wider break-words select-all">{groupedKey}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0"
                    onClick={() => {
                      void navigator.clipboard.writeText(enrollment.secret).then(
                        () => toast.success("Setup key copied"),
                        () => toast.error("Couldn't copy. Select the key and copy it manually."),
                      );
                    }}
                  >
                    <Copy /> Copy
                  </Button>
                </div>
                <p className="text-muted-foreground mt-1.5 text-[11px]">Choose “time-based” if the app asks. Keep this key private.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Step>

      <Step n={2} title="Enter the 6-digit code the app shows">
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError(null);
          }}
          onComplete={submit}
          disabled={pending}
          invalid={!!error}
          aria-label="6-digit code from your authenticator app"
        />
        <ErrorLine error={error} />
      </Step>

      <div className="mt-auto flex gap-2 pt-2">
        <Button type="button" variant="outline" className="h-11 flex-1 sm:h-10" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" className="h-11 flex-1 sm:h-10" disabled={pending || code.length !== 6} onClick={() => submit()}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />} Turn on
        </Button>
      </div>
    </div>
  );
}

function DoneView({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6 text-center">
      <div className="relative flex size-24 items-center justify-center">
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            className="border-success/40 absolute inset-0 rounded-full border-2"
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1.4, delay: 0.25 + i * 0.35, ease: "easeOut" }}
          />
        ))}
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className="bg-success shadow-success/30 flex size-20 items-center justify-center rounded-full text-white shadow-xl"
        >
          <motion.svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.45, ease: EASE }} />
          </motion.svg>
        </motion.span>
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.35, ease: EASE }}>
        <h3 className="text-lg font-semibold">Two-factor authentication is on</h3>
        <p className="text-muted-foreground mx-auto mt-1 max-w-xs text-sm">
          Next time you sign in, enter the code from your authenticator app after your password.
        </p>
      </motion.div>
      <Button className="mt-2 h-11 w-full sm:h-10" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

function OnView({ status, onDisable }: { status: MfaStatus; onDisable: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-5">
      <StatusHero on />
      <dl className="divide-y rounded-xl border text-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-muted-foreground">Method</dt>
          <dd className="flex items-center gap-1.5 font-medium">
            <Smartphone className="text-muted-foreground size-3.5" /> Authenticator app
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-muted-foreground">Turned on</dt>
          <dd className="font-medium">{status.enabledAt ? formatDateTime(status.enabledAt) : "—"}</dd>
        </div>
      </dl>
      <div className="border-destructive/25 mt-auto space-y-3 rounded-xl border p-4">
        <div>
          <p className="text-sm font-medium">Turn off two-factor authentication</p>
          <p className="text-muted-foreground mt-0.5 text-xs">Your account will be protected by your password only. You&apos;ll need a current code to confirm.</p>
        </div>
        <Button variant="outline" className="text-destructive hover:text-destructive h-10 w-full" onClick={onDisable}>
          <ShieldOff /> Turn off
        </Button>
      </div>
    </div>
  );
}

function DisableView({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (code.length !== 6) return;
    setError(null);
    start(async () => {
      const res = await disableMfa(code);
      if (res.ok) onDone();
      else {
        setError(res.error);
        setCode("");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="border-destructive/25 bg-destructive/5 flex gap-3 rounded-xl border p-4">
        <TriangleAlert className="text-destructive mt-0.5 size-4.5 shrink-0" />
        <div>
          <p className="text-sm font-medium">Confirm it&apos;s you</p>
          <p className="text-muted-foreground mt-0.5 text-xs">Enter the current code from your authenticator app to turn two-factor authentication off.</p>
        </div>
      </div>
      <div>
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError(null);
          }}
          disabled={pending}
          invalid={!!error}
          autoFocus
          aria-label="Current 6-digit code"
        />
        <ErrorLine error={error} />
      </div>
      <div className="mt-auto flex gap-2 pt-2">
        <Button type="button" variant="outline" className="h-11 flex-1 sm:h-10" onClick={onCancel} disabled={pending}>
          Keep it on
        </Button>
        <Button type="button" variant="destructive" className="h-11 flex-1 sm:h-10" disabled={pending || code.length !== 6} onClick={submit}>
          {pending ? <Loader2 className="animate-spin" /> : <ShieldOff />} Turn off
        </Button>
      </div>
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="text-destructive mt-2 flex items-center gap-1.5 text-xs"
        >
          <TriangleAlert className="size-3.5 shrink-0" /> {error}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
