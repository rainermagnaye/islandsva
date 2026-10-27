import Link from "next/link";
import type { ReactNode } from "react";
import { AttachmentPreview } from "@/components/ui/attachment-preview";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { adminLeadHref } from "@/content/routes";
import type { Booking } from "@/features/meetings/contract";
import type { LeadDetail, LeadEvent, LeadProfileTab } from "../contract";
import { LeadActions } from "./lead-actions";
import { LeadProfileForm } from "./lead-profile-form";
import { LeadTimeline } from "./lead-timeline";
import { LeadStatusBadge, packageName } from "./lead-status";

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

const stamp = (iso: string) => `${when.format(new Date(iso))} UTC`;

const EMPTY = "—";

/** A website enquiry stores no source until the form sets it. A discovery call is that signal. */
function withWebsiteSource(lead: LeadDetail, meetings: readonly Booking[]): LeadDetail {
  if (lead.profile.source || !meetings.some((meeting) => meeting.kind === "discovery")) return lead;
  return { ...lead, profile: { ...lead.profile, source: "Website" } };
}

/** The lead's own page. A dash is a detail this lead does not have yet. */
export function LeadProfile({ lead, events, meetings, viewerId, tab, editing }: { lead: LeadDetail; events: readonly LeadEvent[]; meetings: readonly Booking[]; viewerId: string; tab: LeadProfileTab; editing: boolean }) {
  const shown = withWebsiteSource(lead, meetings);
  const canDelete = shown.status === "new" && events.length === 0;

  return (
    <div className="grid gap-4">
      <Card as="header" padding="sm" className="flex flex-wrap items-center gap-3">
        <LeadMark name={shown.fullName} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h1 className="m-0 min-w-0 truncate type-h3">
            {shown.fullName}
            {shown.companyName && <span className="font-normal"> - {shown.companyName}</span>}
          </h1>
          <LeadStatusBadge status={shown.status} />
          {shown.disabledAt && <Badge tone="neutral" size="sm" dot>Disabled</Badge>}
        </div>
        <LeadActions lead={shown} viewerId={viewerId} canDelete={canDelete} editing={editing} />
      </Card>

      <ProfileTabs id={shown.id} tab={tab} />

      {editing ? <LeadProfileForm lead={shown} /> : tab === "timeline" ? <LeadTimeline lead={shown} events={events} meetings={meetings} /> : <LeadOverview lead={shown} events={events} />}
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
            <Field label="Number of employees" value={profile.staffCount || EMPTY} />
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

/** Same read-only profile card as an employee profile: a title bar over a two-column field list. */
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
