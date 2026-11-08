"use client";

import Link from "next/link";
import { lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { adminClientHref, adminClientVaHref } from "@/content/routes";
import { cx } from "@/lib/cx";
import { CLIENT_PROFILE_TABS, clientBadge, type ClientDetail, type ClientNote, type ClientPackageValues, type ClientPacketSummary, type ClientProfileTab, type ClientReviewParts } from "../contract";
import { clientOnboardingComplete, clientRegistrationSteps, reviewIssueLabels } from "../registration";
import { OnboardingLinkCard } from "./onboarding-link";
import { SendActivation } from "./client-activation";
import { ClientReviewActions } from "./client-review-actions";
import { ClientActions } from "./client-actions";
import { ClientInvoices, ClientProfileView, ClientStepper } from "./client-profile-view";
import type { ShortlistEntry } from "@/features/matching/contract";
import type { TaskStatus } from "@/features/tasks/contract";

// The editor opens only after "Edit": loaded then, so the profile page doesn't ship it (or its package and time-zone
// data) up front. Notes and assistants stay off first load for the same reason.
const ClientCompanyForm = lazy(() => import("./client-company-form").then((m) => ({ default: m.ClientCompanyForm })));
const ClientNotes = lazy(() => import("./client-notes").then((m) => ({ default: m.ClientNotes })));
const ClientAssistantsPanel = lazy(() => import("./client-assistants-panel").then((m) => ({ default: m.ClientAssistantsPanel })));

/** The client profile: registration progress while it is open, then overview, assistants, notes, consents, or invoices. */
export function ClientProfile({
  client,
  notes,
  packet,
  review,
  assignments,
  offers,
  vas,
  tasks,
  tab,
  editing,
}: {
  client: ClientDetail;
  notes: readonly ClientNote[];
  packet: ClientPacketSummary;
  review: ClientReviewParts;
  assignments: readonly { id: string; vaId: string; vaName: string; startedAt: string }[];
  offers: readonly ShortlistEntry[];
  vas: readonly { id: string; fullName: string }[];
  tasks: readonly { vaId: string; status: TaskStatus }[];
  tab: ClientProfileTab;
  editing: boolean;
}) {
  const router = useRouter();
  const badge = clientBadge(client);
  const steps = clientRegistrationSteps({
    onboardingStatus: client.onboardingStatus,
    accountStatus: client.status,
  });
  const showEditor = editing && tab === "overview";
  const canActivate = client.status === "pending" && !client.disabledAt && client.onboardingStatus === "approved";
  const inReview = client.status === "pending" && !client.disabledAt && client.onboardingStatus === "pending_review";
  const sentBack = client.onboardingStatus === "changes_requested";
  const sentBackText = packet.reviewNote || reviewIssueLabels(packet.reviewIssues).join(", ");
  // The package changes only while the client is pending; once active it's what they signed up on.
  const openPending = client.status === "pending" && !client.disabledAt;
  const currentPackage: ClientPackageValues = { packageCode: client.packageCode, termMonths: client.termMonths, startsOn: client.startsOn, timezone: client.timezone };

  return (
    <div className="grid gap-4">
      <Card as="header" padding="sm" className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h1 className="m-0 min-w-0 truncate type-h3">
            {client.contactName}
            <span className="font-normal"> - {client.companyName}</span>
          </h1>
          <Badge tone={badge.tone} dot={badge.dot}>
            {badge.label}
          </Badge>
        </div>
        {inReview ? (
          <ClientReviewActions
            client={client}
            packet={packet}
            review={review}
            menu={<ClientActions clientId={client.id} editing={showEditor} disabledAt={client.disabledAt} currentPackage={openPending ? currentPackage : undefined} />}
          />
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            {canActivate && <SendActivation clientId={client.id} email={client.contactEmail} />}
            <ClientActions clientId={client.id} editing={showEditor} disabledAt={client.disabledAt} currentPackage={openPending ? currentPackage : undefined} />
          </div>
        )}
      </Card>

      {openPending && <OnboardingLinkCard clientId={client.id} url={packet.url} currentPackage={currentPackage} packageButton={false} />}
      {canActivate && (
        <Alert tone="warning" title="Payment verified, invite not sent">
          Use Send activation to email {client.contactEmail} a link to set a password.
        </Alert>
      )}
      {sentBack && sentBackText && (
        <Alert tone="warning" title="Sent back for a change">
          {sentBackText}
        </Alert>
      )}
      {!clientOnboardingComplete({ onboardingStatus: client.onboardingStatus, accountStatus: client.status }) && <ClientStepper steps={steps} />}
      <ProfileTabs id={client.id} tab={tab} />
      {showEditor ? (
        <Suspense fallback={null}>
          <ClientCompanyForm client={client} onClose={() => router.push(adminClientHref(client.id))} />
        </Suspense>
      ) : tab === "assistants" ? (
        <Suspense fallback={null}>
          <ClientAssistantsPanel
            clientId={client.id}
            assignments={assignments}
            offers={offers}
            vas={vas}
            tasks={tasks}
            hoursPerWeek={client.hoursPerWeek}
            hrefFor={(vaId) => adminClientVaHref(client.id, vaId)}
          />
        </Suspense>
      ) : tab === "notes" ? (
        <Suspense fallback={null}>
          <ClientNotes clientId={client.id} notes={notes} />
        </Suspense>
      ) : tab === "consents" ? (
        review.record
      ) : tab === "invoices" ? (
        <ClientInvoices clientId={client.id} proofName={packet.paymentProofName} proofType={packet.paymentProofType} amount={client.monthlyCents} country={client.business.country} />
      ) : (
        <ClientProfileView client={client} />
      )}
    </div>
  );
}

/** Underline tabs, the same treatment as the meetings status filter. Each section keeps its own URL. */
function ProfileTabs({ id, tab }: { id: string; tab: ClientProfileTab }) {
  const tabs = (Object.keys(CLIENT_PROFILE_TABS) as ClientProfileTab[]).map((key) => ({
    id: key,
    label: CLIENT_PROFILE_TABS[key],
    href: key === "overview" ? adminClientHref(id) : `${adminClientHref(id)}?tab=${key}`,
  }));

  return (
    <nav aria-label="Client profile" className="flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]">
      {tabs.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={item.id === tab ? "page" : undefined}
          className={cx(
            "flex min-h-11 shrink-0 items-center px-3 type-menu whitespace-nowrap no-underline",
            item.id === tab ? "text-action-secondary shadow-[inset_0_-2px_0_var(--color-action-secondary)]" : "text-ink-muted hover:text-ink",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
