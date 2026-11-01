"use client";

import { lazy, Suspense, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { appRoutes } from "@/content/routes";
import type { Booking } from "@/features/meetings/contract";
import type { LeadDetail, LeadEvent, LeadProfileTab } from "../contract";

const LeadProfileForm = lazy(() => import("./lead-profile-form").then((module) => ({ default: module.LeadProfileForm })));
const LeadTimeline = lazy(() => import("./lead-timeline").then((module) => ({ default: module.LeadTimeline })));

/** Edit and timeline stay off first load — overview is the HTML the page already rendered. */
export function LeadProfilePanes({
  lead,
  events,
  meetings,
  tab,
  editing,
  audience,
  overview,
}: {
  lead: LeadDetail;
  events: readonly LeadEvent[];
  meetings: readonly Booking[];
  tab: LeadProfileTab;
  editing: boolean;
  audience: "admin" | "closer";
  overview: ReactNode;
}) {
  if (editing) {
    return (
      <Suspense fallback={null}>
        <LeadProfileForm lead={lead} />
      </Suspense>
    );
  }
  if (tab === "timeline") {
    return (
      <Suspense fallback={null}>
        <ToastProvider>
          <LeadTimeline
            lead={lead}
            events={events}
            meetings={meetings}
            canAddNote={audience === "admin"}
            canManage={audience === "admin"}
            clientsHref={audience === "closer" ? appRoutes.leadgenClients : appRoutes.adminClients}
          />
        </ToastProvider>
      </Suspense>
    );
  }
  return overview;
}
