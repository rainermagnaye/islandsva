import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StatusPanel } from "@/components/layout/status-panel";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { appRoutes } from "@/content/routes";
import { homeFor } from "@/lib/auth/roles";
import { needsSecondFactor, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

/** Single entry point after sign-in: sends each user to their role's workspace. */
export default function DashboardPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <GoHome />
    </Suspense>
  );
}

async function GoHome() {
  const user = await requireUser();
  if (needsSecondFactor(user)) redirect(appRoutes.mfa);
  const home = homeFor(user.roles);
  if (home) redirect(home);

  return (
    <StatusPanel icon="user" title="Your account isn't set up yet">
      <p>You&apos;re signed in, but no workspace has been assigned to your account. Ask your Islands VA contact to finish setting it up.</p>
    </StatusPanel>
  );
}
