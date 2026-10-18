import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Your dashboard" };

export default function ClientHomePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ClientHome />
    </Suspense>
  );
}

async function ClientHome() {
  await requireRole(["client"]);
  return (
    <Workspace title="Your dashboard" lead="See your VA's work, book calls and manage your plan.">
      <ComingSoon title="Your VA card is on its way">
        Soon you&apos;ll see your assistant, their tasks and your subscription here. Until then, your VA and our team are a message away.
      </ComingSoon>
    </Workspace>
  );
}
