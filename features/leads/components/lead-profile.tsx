import Link from "next/link";
import type { ReactNode } from "react";
import { AttachmentPreview } from "@/components/ui/attachment-preview";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { adminLeadHref, appRoutes } from "@/content/routes";
import { LEAD_EVENT_LABELS, type LeadDetail, type LeadEvent, type LeadProfileTab } from "../contract";
import { LeadActions, TimelineButtons } from "./lead-actions";
import { LeadProfileForm } from "./lead-profile-form";
import { LeadStatusBadge, packageName } from "./lead-status";

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

const stamp = (iso: string) => `${when.format(new Date(iso))} UTC`;

const EMPTY = "—";

/** The lead's own page. A dash is a detail this lead does not have yet. */
export function LeadProfile({ lead, events, tab, editing }: { lead: LeadDetail; events: readonly LeadEvent[]; tab: LeadProfileTab; editing: boolean }) {
  const canDelete = lead.status === "new" && events.length === 0;

  return (
    <div className="grid gap-4">
      <Card as="header" padding="sm" className="flex flex-wrap items-center gap-3">
        <LeadMark name={lead.fullName} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h1 className="m-0 min-w-0 truncate type-h3">
            {lead.fullName}
            {lead.companyName && <span className="font-normal"> - {lead.companyName}</span>}
          </h1>
          <LeadStatusBadge status={lead.status} />
          {lead.disabledAt && <Badge tone="neutral" size="sm" dot>Disabled</Badge>}
        </div>
        <LeadActions lead={lead} canDelete={canDelete} editing={editing} />
      </Card>

      <ProfileTabs id={lead.id} tab={tab} />

      {editing ? <LeadProfileForm lead={lead} /> : tab === "timeline" ? <LeadTimeline lead={lead} events={events} /> : <LeadOverview lead={lead} events={events} />}
    </div>
  );
}

/** Pill tabs, the same treatment as the client status filter: a link per section, so the URL can be shared. */
function ProfileTabs({ id, tab }: { id: string; tab: LeadProfileTab }) {
  const tabs: { id: LeadProfileTab; label: string; href: string }[] = [
    { id: "overview", label: "Overview", href: adminLeadHref(id) },
    { id: "timeline", label: "Timeline", href: `${adminLeadHref(id)}?tab=timeline` },
  ];

  return (
    <nav aria-label="Lead profile" className="max-w-full overflow-x-auto [scrollbar-width:none]">
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

function LeadOverview({ lead, events }: { lead: LeadDetail; events: readonly LeadEvent[] }) {
  const owner = lead.closerName ?? EMPTY;

  const profile = lead.profile;

  return (
    <div className="grid gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <FieldCard title="Lead information">
          <Field label="Full name" value={lead.fullName} />
          <Field label="Company" value={lead.companyName ?? EMPTY} />
          <Field label="Job title" value={profile.jobTitle || EMPTY} />
          <Field label="Email" value={<a href={`mailto:${lead.email}`} className="break-all">{lead.email}</a>} />
          <Field label="Phone" value={profile.phone || EMPTY} />
          <Field label="Industry" value={lead.industry ?? EMPTY} />
          <Field label="Lead source" value={profile.source || EMPTY} />
          <Field label="Date created" value={stamp(lead.createdAt)} />
          <Field label="Assigned closer" value={owner} />
          <Field label="Last updated" value={stamp(lead.updatedAt)} />
          <Field label="Discovery notes" value={lead.message} wide />
        </FieldCard>
        <div className="grid content-start gap-4">
          <FieldCard title="Contact preferences">
            <Field label="Preferred contact method" value={profile.contactMethod || EMPTY} />
            <Field label="Best time to reach" value={profile.bestTime || EMPTY} />
            <Field label="Marketing consent" value={profile.consent || EMPTY} />
          </FieldCard>
          <FieldCard title="Business">
            <Field label="Years in service" value={profile.yearsInService || EMPTY} />
            <Field label="Number of staff" value={profile.staffCount || EMPTY} />
            <Field label="Lead status" value={<LeadStatusBadge status={lead.status} />} />
            <Field label="Dropped reason" value={profile.droppedReason || EMPTY} />
          </FieldCard>
        </div>
      </div>

      <FieldCard title="Address">
        <Field label="Street" value={profile.street || EMPTY} wide />
        <Field label="City" value={profile.city || EMPTY} />
        <Field label="State" value={profile.state || EMPTY} />
        <Field label="Zip code" value={profile.zip || EMPTY} />
        <Field label="Country" value={lead.country ?? EMPTY} />
      </FieldCard>

      <FieldCard title="Qualification">
        <Field label="Service of interest" value={packageName(lead.packageCode)} />
        <Field label="Budget range" value={profile.budget || EMPTY} />
        <Field label="Timeline for hiring" value={profile.hiringTimeline || EMPTY} />
        <Field label="Decision maker" value={profile.decisionMaker || EMPTY} />
        <Field label="Priority" value={profile.priority || EMPTY} />
      </FieldCard>

      <LeadFiles lead={lead} events={events} />
    </div>
  );
}

function LeadFiles({ lead, events }: { lead: LeadDetail; events: readonly LeadEvent[] }) {
  const files = events.filter((event) => event.attachmentName && event.attachmentType);
  return (
    <Card as="section" padding="none">
      <h2 className="m-0 border-b border-border px-4 py-3 type-label">Attachments</h2>
      <div className="p-4">
        {files.length === 0 ? (
          <EmptyState compact headingLevel={3} title="No files yet" description="Recordings and files added on the timeline show up here." />
        ) : (
          <ul className="m-0 grid list-none gap-4 sm:grid-cols-2">
            {files.map((event) => (
              <li key={event.id}>
                <AttachmentPreview href={`${adminLeadHref(lead.id)}/files/${event.id}`} name={event.attachmentName ?? ""} type={event.attachmentType ?? ""} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function LeadTimeline({ lead, events }: { lead: LeadDetail; events: readonly LeadEvent[] }) {
  const rows = [
    ...events.map((event) => ({
      key: event.id,
      title: LEAD_EVENT_LABELS[event.kind],
      at: event.createdAt,
      body: event.body,
      author: event.authorName,
      attachment: event.attachmentName && event.attachmentType ? { name: event.attachmentName, type: event.attachmentType, href: `${adminLeadHref(lead.id)}/files/${event.id}` } : null,
    })),
    { key: "enquiry", title: "Lead received", at: lead.createdAt, body: lead.message, author: "Discovery form", attachment: null },
  ];

  return (
    <div className="grid gap-4">
      <Card as="section" padding="none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="m-0 type-label">History</h2>
          <TimelineButtons leadId={lead.id} />
        </div>
        <ol className="m-0 grid list-none gap-0 p-4">
          {rows.map((event, index) => (
            <li key={event.key} className="grid grid-cols-[1.25rem_1fr] gap-3">
              <div className="flex flex-col items-center">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-action-secondary" />
                {index < rows.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
              </div>
              <div className={index < rows.length - 1 ? "grid gap-1 pb-5" : "grid gap-1"}>
                <p className="m-0 type-label text-ink">{event.title}</p>
                <p className="m-0 whitespace-pre-line type-body-sm text-ink">{event.body}</p>
                {event.attachment && <AttachmentPreview href={event.attachment.href} name={event.attachment.name} type={event.attachment.type} />}
                <p className="m-0 type-body-sm text-ink-muted">
                  <time dateTime={event.at}>{stamp(event.at)}</time>
                  {" · "}
                  {event.author}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <FieldCard title="Activity">
        <Field label="Discovery call logs" value={EMPTY} wide />
        <Field label="Follow-up notes" value={EMPTY} wide />
        <Field label="Status changes" value={EMPTY} wide />
        <Field label="Closer changes" value={EMPTY} wide />
        <Field
          label="Conversion"
          wide
          value={
            lead.status === "converted" ? (
              <Link href={appRoutes.adminClients}>This lead is now a client. View clients.</Link>
            ) : (
              EMPTY
            )
          }
        />
      </FieldCard>
    </div>
  );
}

function LeadMark({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-surface-sunken type-h4 text-ink" aria-hidden="true">
      {initials || <Icon name="user" size={22} />}
    </span>
  );
}

/** Same read-only profile card as a staff profile: a title bar over a two-column field list. */
function FieldCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section" padding="none">
      <h2 className="m-0 border-b border-border px-4 py-3 type-label">{title}</h2>
      <dl className="m-0 grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">{children}</dl>
    </Card>
  );
}

function Field({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "min-w-0 sm:col-span-2" : "min-w-0"}>
      <dt className="type-caption text-ink-muted">{label}</dt>
      <dd className={`m-0 whitespace-pre-line break-words type-body-sm ${value === EMPTY ? "text-ink-muted" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
