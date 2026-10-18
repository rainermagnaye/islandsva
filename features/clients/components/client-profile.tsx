"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { adminClientHref } from "@/content/routes";
import { CLIENT_PROFILE_TABS, CLIENT_STATUS_LABELS, clientRegistrationSteps, type ClientDetail, type ClientNote, type ClientProfileTab, type ClientStatus } from "../contract";
import { ClientActions } from "./client-actions";
import { ClientCompanyForm } from "./client-company-form";
import { ClientNotes } from "./client-notes";
import { ClientConsents, ClientInvoices, ClientProfileView, ClientStepper } from "./client-profile-view";

const TONES: Record<ClientStatus, BadgeTone> = { pending: "warning", active: "success", inactive: "neutral" };

/** The client profile: registration progress, then overview, notes, consents, or invoices. */
export function ClientProfile({ client, notes, tab, editing }: { client: ClientDetail; notes: readonly ClientNote[]; tab: ClientProfileTab; editing: boolean }) {
  const router = useRouter();
  const steps = clientRegistrationSteps(client.business);
  const showEditor = editing && tab === "overview";

  return (
    <div className="grid gap-4">
      <Card as="header" padding="sm" className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h1 className="m-0 min-w-0 truncate type-h3">
            {client.contactName}
            <span className="font-normal"> - {client.companyName}</span>
          </h1>
          {client.disabledAt ? (
            <Badge tone="neutral" size="sm" dot>
              Disabled
            </Badge>
          ) : (
            <Badge tone={TONES[client.status]} dot={client.status === "inactive"}>
              {CLIENT_STATUS_LABELS[client.status]}
            </Badge>
          )}
        </div>
        <ClientActions clientId={client.id} editing={showEditor} disabledAt={client.disabledAt} />
      </Card>

      <ClientStepper steps={steps} />
      <ProfileTabs id={client.id} tab={tab} />
      {showEditor ? (
        <ClientCompanyForm client={client} onClose={() => router.push(adminClientHref(client.id))} />
      ) : tab === "notes" ? (
        <ClientNotes clientId={client.id} notes={notes} />
      ) : tab === "consents" ? (
        <ClientConsents />
      ) : tab === "invoices" ? (
        <ClientInvoices />
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
