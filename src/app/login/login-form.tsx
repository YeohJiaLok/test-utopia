"use client";

import { useActionState, useState, useTransition } from "react";
import { motion } from "motion/react";
import { ArrowRight, BarChart3, ClipboardList, Loader2, Snowflake, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { EASE } from "@/components/motion";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { cn } from "@/lib/utils";
import { demoLoginAction, loginAction, type LoginState } from "./actions";

const ROLE_ICON = { admin: ClipboardList, technician: Wrench, manager: BarChart3 } as const;
const PRIMARY_DEMOS = DEMO_ACCOUNTS.filter((a) => ["admin", "ali", "manager"].includes(a.key));

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [demoPending, startDemo] = useTransition();
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  function demo(key: string) {
    setActiveDemo(key);
    startDemo(async () => {
      const res = await demoLoginAction(key);
      if (res?.error) {
        toast.error(res.error);
        setActiveDemo(null);
      }
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="w-full max-w-md"
    >
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <span className="bg-gradient-brand flex size-9 items-center justify-center rounded-xl text-white">
          <Snowflake className="size-5" />
        </span>
        <p className="font-semibold">Sejuk Ops</p>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="text-muted-foreground mt-1 text-sm">Sign in to the operations portal.</p>

      <div className="mt-6 space-y-2.5">
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Instant demo access</p>
        {PRIMARY_DEMOS.map((a, i) => {
          const Icon = ROLE_ICON[a.role];
          const loading = demoPending && activeDemo === a.key;
          return (
            <motion.button
              key={a.key}
              type="button"
              disabled={demoPending}
              onClick={() => demo(a.key)}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.1 + i * 0.07 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={cn(
                "group bg-card hover:border-primary/40 flex w-full items-center gap-3 rounded-xl border p-3 text-left shadow-xs transition-colors hover:shadow-md disabled:opacity-60",
                loading && "border-primary/50",
              )}
            >
              <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {a.fullName} <span className="text-muted-foreground font-normal">· {a.title}</span>
                </span>
                <span className="text-muted-foreground block truncate text-xs">{a.blurb}</span>
              </span>
              {loading ? (
                <Loader2 className="text-primary size-4 animate-spin" />
              ) : (
                <ArrowRight className="text-muted-foreground group-hover:text-primary size-4 transition-transform group-hover:translate-x-0.5" />
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="my-6 flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">or sign in with email</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <FormField label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@sejuk.demo" className="h-10" required />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" className="h-10" required />
        </FormField>
        {state.error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="text-destructive bg-destructive/8 rounded-lg px-3 py-2 text-sm"
          >
            {state.error}
          </motion.p>
        )}
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Sign in
        </Button>
      </form>
    </motion.div>
  );
}
