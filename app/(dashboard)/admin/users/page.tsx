import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { TeamBoard } from "@/features/users/components/team-board";
import { listUsers } from "@/features/users/dal";
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
  const users = await listUsers();

  return <TeamBoard users={users} />;
}
