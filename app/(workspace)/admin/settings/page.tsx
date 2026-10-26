import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Panel } from "@/components/ui/card";
import { DiscoveryTimesForm } from "@/features/meetings/components/discovery-times-form";
import { DISCOVERY_LIMITS, DISCOVERY_ZONE } from "@/features/meetings/contract";
import { listDiscoveryTimes } from "@/features/meetings/dal";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

const savedLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: DISCOVERY_ZONE });

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await requireRole(["admin"]);
  const { times, savedAt } = await listDiscoveryTimes();
  return (
    <Workspace title="Settings">
      <Panel title="Discovery calls" boxed>
        <p className="m-0 type-body text-ink-muted">
          Every day at these times (Philippine time), visitors can request a {DISCOVERY_LIMITS.callMinutes}-minute call, from{" "}
          {DISCOVERY_LIMITS.minNoticeHours} hours to {DISCOVERY_LIMITS.maxDaysAhead} days ahead. Calls already requested keep their
          time. Clear all times to stop offering calls.
        </p>
        <DiscoveryTimesForm saved={times} />
        {savedAt && <p className="m-0 type-body-sm text-ink-muted">Last saved {savedLabel.format(new Date(savedAt))} (Philippine time)</p>}
      </Panel>
    </Workspace>
  );
}
