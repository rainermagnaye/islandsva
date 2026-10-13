import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { InviteStaffForm } from "@/features/users/components/invite-staff-form";
import { UsersTable } from "@/features/users/components/users-table";
import { listUsers } from "@/features/users/dal";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Team and accounts" };

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminUsers />
    </Suspense>
  );
}

async function AdminUsers() {
  await requireRole(["admin"]);
  const users = await listUsers();

  return (
    <Workspace title="Team and accounts" lead="Invite your team. Each person gets an email to choose a password; admins also set up two-factor sign-in.">
      <section aria-labelledby="invite-title" className="grid max-w-3xl gap-4 rounded-lg border border-border bg-surface-card p-6">
        <h2 id="invite-title" className="m-0 type-h3">
          Invite a team member
        </h2>
        <InviteStaffForm />
      </section>
      <section aria-labelledby="people-title" className="grid gap-4">
        <h2 id="people-title" className="m-0 type-h3">
          Everyone with access ({users.length})
        </h2>
        <UsersTable users={users} />
      </section>
    </Workspace>
  );
}
