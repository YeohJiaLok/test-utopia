"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Menu, Search, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { NAV, type NavSection } from "@/lib/routes";
import type { AppRole, Notification, SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EASE } from "@/components/motion";
import { NavIcon } from "./nav-icon";
import { NotificationBell } from "./notification-bell";
import { CommandPalette } from "./command-palette";
import { UserMenu } from "./user-menu";

export type NavBadges = Partial<Record<"reviews" | "flags" | "jobs" | "unassigned", number>>;

function isActive(pathname: string, href: string, all: string[]) {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  // Prefer the most specific nav entry (e.g. /admin/orders/new over /admin/orders)
  return !all.some((h) => h !== href && h.startsWith(href) && (pathname === h || pathname.startsWith(`${h}/`)));
}

/** Each portal has its own name and accent colour (see [data-portal] in globals.css). */
const PORTAL: Record<AppRole, string> = { admin: "Admin Console", technician: "Field App", manager: "Manager Hub" };

/**
 * Dialogs, sheets and popovers render in portals under <body>, outside the shell, so the
 * portal theme is mirrored onto <body> too.
 */
function usePortalTheme(role: AppRole) {
  useEffect(() => {
    document.body.dataset.portal = role;
    return () => {
      delete document.body.dataset.portal;
    };
  }, [role]);
}

function Brand({ role }: { role: AppRole }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5 px-2">
      <span className="bg-gradient-brand shadow-brand/30 flex size-8 items-center justify-center rounded-lg text-white shadow-md transition-transform duration-300 group-hover:scale-105 group-hover:rotate-12">
        <Snowflake className="size-4.5" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight">Sejuk Ops</span>
        <span className="text-primary block text-[11px] font-medium">{PORTAL[role]}</span>
      </span>
    </Link>
  );
}

/** Soft accent wash at the top of every page, in the portal colour. */
function PortalGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,var(--portal-tint),transparent_70%)]"
    />
  );
}

function SidebarNav({
  sections,
  badges,
  onNavigate,
  layoutId,
}: {
  sections: NavSection[];
  badges: NavBadges;
  onNavigate?: () => void;
  layoutId: string;
}) {
  const pathname = usePathname();
  const all = sections.flatMap((s) => s.items.map((i) => i.href));
  return (
    <nav className="space-y-6">
      {sections.map((section, si) => (
        <div key={si} className="space-y-1">
          {section.title && (
            <p className="text-muted-foreground px-3 pb-1 text-[11px] font-semibold tracking-wider uppercase">{section.title}</p>
          )}
          {section.items.map((item) => {
            const active = isActive(pathname, item.href, all);
            const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
                  active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                )}
              >
                {active && (
                  <motion.span
                    layoutId={layoutId}
                    className="bg-sidebar-accent absolute inset-0 rounded-lg"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                {active && (
                  <motion.span
                    layoutId={`${layoutId}-bar`}
                    className="bg-primary absolute top-2 bottom-2 left-0 w-0.5 rounded-full"
                  />
                )}
                <NavIcon name={item.icon} className={cn("relative size-4", active && "text-primary")} />
                <span className="relative flex-1">{item.label}</span>
                {!!badge && (
                  <span className="bg-primary/12 text-primary relative rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Breadcrumb({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const all = sections.flatMap((s) => s.items);
  const match = [...all].sort((a, b) => b.href.length - a.href.length).find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  const extra = match && pathname !== match.href ? "Details" : null;
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm">
      <span className="truncate font-medium">{match?.label ?? "Sejuk Ops"}</span>
      {extra && (
        <>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground truncate">{extra}</span>
        </>
      )}
    </div>
  );
}

export function AppShell({
  user,
  badges,
  notifications,
  aside,
  children,
}: {
  user: SessionUser;
  badges: NavBadges;
  notifications: Notification[];
  /** Role-specific floating UI (e.g. AI copilot drawer) */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const sections = NAV[user.role];
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  usePortalTheme(user.role);

  // Technicians: full desktop layout on lg+, a native-app feel on phones (brand header + bottom tabs).
  const isTech = user.role === "technician";
  const tabs = sections.flatMap((section) => section.items);

  return (
    <div data-portal={user.role} className="relative isolate min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      <PortalGlow />
      <aside className="bg-sidebar sticky top-0 hidden h-dvh flex-col border-r px-3 py-4 lg:flex">
        <div className="bg-gradient-brand absolute inset-x-0 top-0 h-0.5" />
        <Brand role={user.role} />
        <div className="scrollbar-thin mt-6 flex-1 overflow-y-auto">
          <SidebarNav sections={sections} badges={badges} layoutId="nav-active" />
        </div>
        <div className="border-t pt-3">
          <UserMenu user={user} />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="bg-sidebar w-72 p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand role={user.role} />
          <div className="mt-6">
            <SidebarNav sections={sections} badges={badges} onNavigate={() => setMobileOpen(false)} layoutId="nav-active-mobile" />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col">
        <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur-md lg:px-8">
          {isTech ? (
            <div className="lg:hidden">
              <Brand role={user.role} />
            </div>
          ) : (
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu />
            </Button>
          )}
          <div className={cn("min-w-0", isTech && "hidden lg:block")}>
            <Breadcrumb sections={sections} />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
              className="text-muted-foreground hover:bg-muted hidden h-8 w-64 items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors md:flex"
            >
              <Search className="size-4" />
              <span>Search orders…</span>
              <kbd className="bg-muted ml-auto rounded px-1.5 font-mono text-[10px]">Ctrl K</kbd>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
              aria-label="Search"
            >
              <Search />
            </Button>
            <NotificationBell userId={user.id} role={user.role} initial={notifications} />
            <div className="lg:hidden">
              <UserMenu user={user} compact />
            </div>
          </div>
        </header>
        <main className={cn("mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8 lg:py-8", isTech && "pb-28 lg:pb-8")}>
          <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
            {children}
          </motion.div>
        </main>
      </div>
      {isTech && <MobileTabBar tabs={tabs} badges={badges} pathname={pathname} />}
      <CommandPalette nav={sections} />
      {aside}
    </div>
  );
}

/** Phone-only bottom tab bar for the technician Field App (hidden on lg+, where the sidebar takes over). */
function MobileTabBar({ tabs, badges, pathname }: { tabs: NavSection["items"]; badges: NavBadges; pathname: string }) {
  return (
    <nav className="bg-background/90 safe-bottom fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-lg px-4 pt-2" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const active = t.href === "/tech" ? pathname === "/tech" || pathname.startsWith("/tech/jobs") : pathname.startsWith(t.href);
          const badge = t.badgeKey ? badges[t.badgeKey] : undefined;
          return (
            <Link key={t.href} href={t.href} className="relative flex min-h-12 flex-col items-center justify-center gap-1 py-1.5">
              {active && <motion.span layoutId="tab-active" className="bg-primary/10 absolute inset-x-6 inset-y-0 rounded-xl" />}
              <span className="relative">
                <NavIcon name={t.icon} className={cn("size-5", active ? "text-primary" : "text-muted-foreground")} />
                {!!badge && (
                  <span className="bg-primary text-primary-foreground absolute -top-1.5 -right-2.5 rounded-full px-1 text-[10px] font-semibold">
                    {badge}
                  </span>
                )}
              </span>
              <span className={cn("relative text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
