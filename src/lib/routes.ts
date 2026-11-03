import type { AppRole } from "@/lib/types";

/** Canonical order URL for each role's portal. */
export function orderHref(role: AppRole, orderId: string) {
  switch (role) {
    case "admin":
      return `/admin/orders/${orderId}`;
    case "manager":
      return `/manager/orders/${orderId}`;
    case "technician":
      return `/tech/jobs/${orderId}`;
  }
}

export interface NavItem {
  href: string;
  label: string;
  icon: string; // lucide icon name, resolved in the shell
  badgeKey?: "reviews" | "flags" | "jobs" | "unassigned";
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV: Record<AppRole, NavSection[]> = {
  admin: [
    {
      items: [
        { href: "/admin", label: "Overview", icon: "LayoutDashboard" },
        { href: "/admin/orders", label: "Orders", icon: "ClipboardList", badgeKey: "unassigned" },
        { href: "/admin/orders/new", label: "New order", icon: "FilePlus2" },
        { href: "/admin/technicians", label: "Technicians", icon: "Users" },
        { href: "/admin/notifications", label: "WhatsApp outbox", icon: "MessageCircle" },
      ],
    },
    {
      title: "Insights",
      items: [
        { href: "/manager", label: "Performance", icon: "BarChart3" },
        { href: "/audit", label: "Audit log", icon: "ScrollText" },
      ],
    },
  ],
  manager: [
    {
      items: [
        { href: "/manager", label: "Dashboard", icon: "BarChart3" },
        { href: "/manager/reviews", label: "Review queue", icon: "ClipboardCheck", badgeKey: "reviews" },
      ],
    },
    {
      title: "AI",
      items: [
        { href: "/manager/assistant", label: "Ops Copilot", icon: "Sparkles" },
        { href: "/manager/flags", label: "AI Supervisor", icon: "ShieldAlert", badgeKey: "flags" },
      ],
    },
    {
      title: "Governance",
      items: [{ href: "/audit", label: "Audit log", icon: "ScrollText" }],
    },
  ],
  technician: [
    {
      items: [
        { href: "/tech", label: "My jobs", icon: "Wrench", badgeKey: "jobs" },
        { href: "/tech/history", label: "History", icon: "History" },
      ],
    },
  ],
};
