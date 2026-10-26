import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { getOwnClientId } from "@/features/clients/dal";
import { MatchList } from "@/features/matching/components/match-list";
import { listShortlist } from "@/features/matching/dal";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "VA Match" };

export default function ClientMatchPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ClientMatch />
    </Suspense>
  );
}

async function ClientMatch() {
  const user = await requireRole(["client"]);
  const clientId = await getOwnClientId(user.id);
  if (!clientId) {
    return (
      <Workspace title="VA Match">
        <ComingSoon title="Your account is being set up">Your Islands VA contact is finishing your setup. Check back soon, or reply to their email.</ComingSoon>
      </Workspace>
    );
  }
  const offers = await listShortlist(clientId);

  return (
    <Workspace title="VA Match" lead="Accept a VA to start working together, or decline and wait for another offer.">
      <MatchList offers={offers} />
    </Workspace>
  );
}
