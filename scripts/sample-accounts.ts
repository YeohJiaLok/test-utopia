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
  {
    key: "weijie",
    email: "weijie.tech@sejuk.com",
    fullName: "Tan Wei Jie",
    role: "technician",
    title: "Technician · Kuala Lumpur",
    blurb: "Technician account",
  },
  {
    key: "hafiz",
    email: "hafiz.tech@sejuk.com",
    fullName: "Hafiz Rahman",
    role: "technician",
    title: "Technician · Kuala Lumpur",
    blurb: "Technician account",
  },
  {
    key: "kumar",
    email: "kumar.tech@sejuk.com",
    fullName: "Kumar Selvam",
    role: "technician",
    title: "Technician · Petaling Jaya",
    blurb: "Technician account",
  },
  {
    key: "azman",
    email: "azman.tech@sejuk.com",
    fullName: "Azman Yusof",
    role: "technician",
    title: "Technician · Petaling Jaya",
    blurb: "Technician account",
  },
  {
    key: "rizal",
    email: "rizal.tech@sejuk.com",
    fullName: "Rizal Ahmad",
    role: "technician",
    title: "Technician · Johor Bahru",
    blurb: "Technician account",
  },
  {
    key: "kahwai",
    email: "kahwai.tech@sejuk.com",
    fullName: "Chong Kah Wai",
    role: "technician",
    title: "Technician · Johor Bahru",
    blurb: "Technician account",
  },
  {
    key: "siva",
    email: "siva.tech@sejuk.com",
    fullName: "Siva Raman",
    role: "technician",
    title: "Technician · Johor Bahru",
    blurb: "Technician account",
  },
  {
    key: "arif",
    email: "arif.tech@sejuk.com",
    fullName: "Arif Hakim",
    role: "technician",
    title: "Technician · Penang",
    blurb: "Technician account",
  },
  {
    key: "boonhuat",
    email: "boonhuat.tech@sejuk.com",
    fullName: "Lim Boon Huat",
    role: "technician",
    title: "Technician · Penang",
    blurb: "Technician account",
  },
];
