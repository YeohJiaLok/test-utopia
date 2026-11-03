import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getBranches } from "@/lib/data/reference";
import { PageHeader } from "@/components/shared/page-header";
import { UsersAdmin } from "@/components/admin/users-admin";
import { getUnlinkedTechnicians, getUsers } from "./_lib/users";

export const metadata: Metadata = { title: "Users & roles · Sejuk Ops" };

export default async function UsersPage() {
  const me = await requireUser(["admin"]);
  const [users, branches, unlinked] = await Promise.all([getUsers(), getBranches(), getUnlinkedTechnicians()]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Users & roles"
        description="Create accounts, assign a role and control access. Each role signs in to its own portal; every change is recorded in the audit log."
      />
      <UsersAdmin users={users} branches={branches} unlinkedTechnicians={unlinked} currentUserId={me.id} />
    </div>
  );
}
