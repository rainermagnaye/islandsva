import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { TeamBoard } from "@/features/users/components/team-board";
import { countUsers, listUsers } from "@/features/users/dal";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Teams" };

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminUsers />
    </Suspense>
  );
}

async function AdminUsers() {
  await requireRole(["admin"]);
  // The board searches in the browser over the newest accounts; the count says when that isn't everyone.
  const [users, total] = await Promise.all([listUsers(), countUsers()]);

  return <TeamBoard users={users} total={total} />;
}
