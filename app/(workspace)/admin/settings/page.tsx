import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await requireRole(["admin"]);
  return (
    <Workspace title="Settings">
      <ComingSoon title="Settings">Account settings will live here.</ComingSoon>
    </Workspace>
  );
}
