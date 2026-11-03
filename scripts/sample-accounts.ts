import type { AppRole } from "../src/lib/types";

/**
 * Sample accounts created by scripts/seed.ts. They sign in like anyone else (email + password,
 * password from SEED_PASSWORD); nothing in the app lists them.
 */
export interface SampleAccount {
  key: string;
  email: string;
  fullName: string;
  role: AppRole;
  title: string;
  blurb: string;
}

export const SAMPLE_ACCOUNTS: SampleAccount[] = [
  {
    key: "admin",
    email: "jialok.admin@sejuk.com",
    fullName: "Jialok Yeoh",
    role: "admin",
    title: "Operations Admin",
    blurb: "Create orders, dispatch technicians, AI document intake",
  },
  {
    key: "benny",
    email: "benny.tech@sejuk.com",
    fullName: "Benny Wong",
    role: "technician",
    title: "Technician · Shah Alam",
    blurb: "Field technician account",
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
