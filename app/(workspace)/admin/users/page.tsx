import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { TeamBoard } from "@/features/users/components/team-board";
import { countEmployees, listEmployees, listUninvitedIds } from "@/features/users/dal";
import { requireRole } from "@/lib/auth/session";
import { searchFrom } from "../_components/search-params";

export const metadata: Metadata = { title: "Teams" };

export default function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminUsers searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminUsers({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  await requireRole(["admin"]);
  const query = await searchParams;
  const q = searchFrom(query.q) ?? "";
  // Teams is staff only (VA, Lead Gen, admin); client logins live on Clients. The board searches in the browser
  // over the newest employees; the count says when that isn't everyone.
  const [employees, total] = await Promise.all([listEmployees(), countEmployees()]);
  // listUninvitedIds reads Supabase Auth with the secret key; requireRole above has already checked the admin.
  const uninvited = await listUninvitedIds(employees.map((user) => user.id));
  const users = employees.map((user) => ({ ...user, invited: !uninvited.has(user.id) }));

  return <TeamBoard key={q} users={users} total={total} initialQuery={q} />;
}
