import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell, type NavBadges } from "@/components/shell/app-shell";
import { CopilotDrawer } from "@/components/ai/copilot-drawer";
import type { Notification } from "@/lib/types";
import { lateCutoff } from "@/lib/workflow";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();

  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);

  const [notifications, badges] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("recipient_profile_id", user.id)
      .eq("channel", "in_app")
      .order("created_at", { ascending: false })
      .limit(20)
      .then((r) => (r.data ?? []) as Notification[]),
    (async (): Promise<NavBadges> => {
      switch (user.role) {
        case "admin":
          return {
            // Jobs whose start time has passed with nobody on site (see LATE_GRACE_MINUTES).
            late: await count(
              supabase
                .from("orders")
                .select("id", { count: "exact", head: true })
                .eq("status", "assigned")
                .lt("scheduled_at", lateCutoff()),
            ),
          };
        case "manager": {
          const [reviews, flags] = await Promise.all([
            count(supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "job_done")),
            count(supabase.from("ai_flags").select("id", { count: "exact", head: true }).eq("resolved", false)),
          ]);
          return { reviews, flags };
        }
        case "technician":
          return {
            jobs: await count(
              supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["assigned", "in_progress"]),
            ),
          };
      }
    })(),
  ]);

  return (
    <AppShell
      user={user}
      badges={badges}
      notifications={notifications}
      aside={user.role === "manager" || user.role === "admin" ? <CopilotDrawer /> : null}
    >
      {children}
    </AppShell>
  );
}
