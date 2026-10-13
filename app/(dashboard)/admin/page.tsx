import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { IconBadge } from "@/components/ui/icon-badge";
import { appRoutes } from "@/content/routes";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Admin" };

export default function AdminHomePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminHome />
    </Suspense>
  );
}

// Admins only. Closers have their own workspace (/closer).
async function AdminHome() {
  await requireRole(["admin"]);

  return (
    <Workspace title="Admin" lead="Clients, team and sales at a glance.">
      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href={appRoutes.adminUsers}
          className="grid content-start gap-3 rounded-lg border border-border bg-surface-card p-6 text-ink no-underline hover:border-border-strong hover:elevation-md"
        >
          <IconBadge name="users" />
          <span className="type-h3">Team and accounts</span>
          <span className="text-ink-muted">Invite VAs, Closers and Admins, and see everyone with access.</span>
        </Link>
      </div>
    </Workspace>
  );
}
