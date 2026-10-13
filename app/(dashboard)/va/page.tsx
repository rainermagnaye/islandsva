import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "VA workspace" };

export default function VaHomePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <VaHome />
    </Suspense>
  );
}

async function VaHome() {
  await requireRole(["va"]);
  return (
    <Workspace title="VA workspace" lead="Your clients, demo requests and schedule.">
      <ComingSoon title="Your client list is on its way">
        Soon you&apos;ll see your assigned clients here and confirm or decline demo calls.
      </ComingSoon>
    </Workspace>
  );
}
