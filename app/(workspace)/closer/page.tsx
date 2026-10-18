import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Closer workspace" };

export default function CloserHomePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <CloserHome />
    </Suspense>
  );
}

async function CloserHome() {
  await requireRole(["closer"]);
  return (
    <Workspace title="Closer workspace" lead="Your clients, onboarding forms and activations.">
      <ComingSoon title="Client onboarding is on its way">
        Soon you&apos;ll create client profiles here, send their onboarding forms and activate their accounts.
      </ComingSoon>
    </Workspace>
  );
}
