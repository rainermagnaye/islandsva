"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { adminClientHref } from "@/content/routes";
import { CLIENT_PROFILE_TABS, CLIENT_REVIEW_SECTION_LABELS, clientBadge, clientRegistrationSteps, type ClientDetail, type ClientNote, type ClientPacketSummary, type ClientProfileTab } from "../contract";
import { OnboardingLinkCard } from "./onboarding-link";
import { SendActivation } from "./client-activation";
import { ClientReviewActions } from "./client-review-actions";
import { ClientActions } from "./client-actions";
import { ClientCompanyForm } from "./client-company-form";
import { ClientNotes } from "./client-notes";
import { ClientConsents, ClientInvoices, ClientProfileView, ClientStepper } from "./client-profile-view";

/** The client profile: registration progress, then overview, notes, consents, or invoices. */
export function ClientProfile({
  client,
  notes,
  packet,
  tab,
  editing,
}: {
  client: ClientDetail;
  notes: readonly ClientNote[];
  packet: ClientPacketSummary;
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
  const sentBackText = packet.reviewNote || packet.reviewIssues.map((id) => CLIENT_REVIEW_SECTION_LABELS[id]).join(", ");

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
            menu={<ClientActions clientId={client.id} editing={showEditor} disabledAt={client.disabledAt} />}
          />
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            {canActivate && <SendActivation clientId={client.id} email={client.contactEmail} />}
            <ClientActions clientId={client.id} editing={showEditor} disabledAt={client.disabledAt} />
          </div>
        )}
      </Card>

      {client.status === "pending" && !client.disabledAt && <OnboardingLinkCard clientId={client.id} url={packet.url} />}
      {sentBack && sentBackText && (
        <Alert tone="warning" title="Sent back for a change">
          {sentBackText}
        </Alert>
      )}
      <ClientStepper steps={steps} />
      <ProfileTabs id={client.id} tab={tab} />
      {showEditor ? (
        <ClientCompanyForm client={client} onClose={() => router.push(adminClientHref(client.id))} />
      ) : tab === "notes" ? (
        <ClientNotes clientId={client.id} notes={notes} />
      ) : tab === "consents" ? (
        <ClientConsents consent={packet.consentName ? { name: packet.consentName, signedAt: packet.consentSignedAt } : null} />
      ) : tab === "invoices" ? (
        <ClientInvoices clientId={client.id} proofName={packet.paymentProofName} proofType={packet.paymentProofType} amount={client.monthlyCents} country={client.business.country} />
      ) : (
        <ClientProfileView client={client} />
      )}
    </div>
  );
}

/** Pill tabs, so a note, consent or invoice list can be shared. */
function ProfileTabs({ id, tab }: { id: string; tab: ClientProfileTab }) {
  const tabs = (Object.keys(CLIENT_PROFILE_TABS) as ClientProfileTab[]).map((key) => ({
    id: key,
    label: CLIENT_PROFILE_TABS[key],
    href: key === "overview" ? adminClientHref(id) : `${adminClientHref(id)}?tab=${key}`,
  }));

  return (
    <nav aria-label="Client profile" className="max-w-full overflow-x-auto [scrollbar-width:none]">
      <ul className="m-0 inline-flex list-none gap-1 rounded-pill bg-surface-sunken p-1">
        {tabs.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              aria-current={item.id === tab ? "page" : undefined}
              className="inline-flex min-h-9 items-center rounded-pill px-4 type-label whitespace-nowrap text-ink-muted no-underline transition-colors hover:bg-action-ghost-hover hover:text-ink aria-[current=page]:bg-surface-card aria-[current=page]:text-action-secondary aria-[current=page]:elevation-sm"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
