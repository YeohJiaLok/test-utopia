import type { Metadata } from "next";
import { FadeIn } from "@/components/motion";
import { JobsBoard } from "@/components/tech/jobs-board";
import { greetingFor, longToday } from "@/components/tech/lib";
import { requireUser } from "@/lib/auth";
import { getMyJobs } from "./queries";

export const metadata: Metadata = { title: "My jobs" };

export default async function TechJobsPage() {
  const user = await requireUser(["technician"]);
  const { active, upcoming, doneToday, collectedToday } = await getMyJobs(user.technicianId);
  const firstName = user.fullName.split(/\s+/)[0] ?? user.fullName;

  return (
    <div className="space-y-5">
      <FadeIn>
        <p className="text-muted-foreground text-sm">{longToday()}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          {greetingFor()}, <span className="text-gradient-brand">{firstName}</span>
        </h1>
      </FadeIn>
      <JobsBoard active={active} upcoming={upcoming} doneToday={doneToday} collectedToday={collectedToday} />
    </div>
  );
}
