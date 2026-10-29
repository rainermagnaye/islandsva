import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { LazyVaRegistration } from "@/features/users/components/lazy-va-registration";
import { employeeAccessBadge } from "@/features/users/contract";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";
import { VaDashboard } from "./_components/va-dashboard";

export const metadata: Metadata = { title: "VA workspace" };

export default function VaHomePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <VaHome />
    </Suspense>
  );
}

async function VaHome() {
  const user = await requireRole(["va"]);
  const access = await loadVaAccess(user.id);
  if (access.open) return <VaDashboard vaId={user.id} firstName={access.account?.fullName.trim().split(/\s+/)[0] || "there"} />;
  if (!access.account) return <Workspace title="Dashboard" />;
  const account = access.account;
  const review = access.profile?.reviewStatus ?? "pending";
  const badge = employeeAccessBadge({ roles: account.roles, accountStatus: account.status, review: access.profile?.reviewStatus ?? null, signedIn: account.signedInAt !== null });

  return (
    <Container className="grid gap-4 py-10 md:py-12">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 type-h1">Your profile</h1>
          <Badge tone={badge.tone} size="sm">{badge.label}</Badge>
        </div>
        {review !== "pending_review" && (
          <p className="m-0 max-w-[60ch] text-ink-muted">Fill in every section, then send it for review. The rest of the workspace opens once we confirm the profile.</p>
        )}
      </div>
      {review === "pending_review" && (
        <Alert tone="info" title="An admin will review your details">
          We&apos;ll open the rest of the workspace once the profile is confirmed.
        </Alert>
      )}
      {access.profile?.returnNote && access.profile.reviewStatus === "pending" && (
        <Alert tone="warning" title="A few details need a change">
          {access.profile.returnNote}
        </Alert>
      )}
      <LazyVaRegistration user={access.account} profile={access.profile} />
    </Container>
  );
}
