import type { AppRole } from "@/lib/types";

/** Seeded demo accounts (see scripts/seed.ts). Shared by the seed script and the login screen. */
export interface DemoAccount {
  key: string;
  email: string;
  fullName: string;
  role: AppRole;
  title: string;
  blurb: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: "admin",
    email: "admin@sejuk.demo",
    fullName: "Aisyah Rahman",
    role: "admin",
    title: "Operations Admin",
    blurb: "Create orders, dispatch technicians, AI document intake",
  },
  {
    key: "ali",
    email: "ali@sejuk.demo",
    fullName: "Ali Hassan",
    role: "technician",
    title: "Technician · Shah Alam",
    blurb: "Mobile job list, on-site completion, photo upload",
  },
  {
    key: "manager",
    email: "manager@sejuk.demo",
    fullName: "Daniel Tan",
    role: "manager",
    title: "Operations Manager",
    blurb: "KPI dashboard, job reviews, AI copilot & supervisor",
  },
  {
    key: "john",
    email: "john@sejuk.demo",
    fullName: "John Lim",
    role: "technician",
    title: "Technician · Kuala Lumpur",
    blurb: "Second technician — verify job isolation (RLS)",
  },
  {
    key: "bala",
    email: "bala@sejuk.demo",
    fullName: "Bala Krishnan",
    role: "technician",
    title: "Technician · Petaling Jaya",
    blurb: "Busiest technician this week",
  },
  {
    key: "yusoff",
    email: "yusoff@sejuk.demo",
    fullName: "Yusoff Ismail",
    role: "technician",
    title: "Technician · Shah Alam",
    blurb: "Technician account",
  },
];
