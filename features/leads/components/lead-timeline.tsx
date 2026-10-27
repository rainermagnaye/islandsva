"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AttachmentPreview } from "@/components/ui/attachment-preview";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { adminLeadHref, appRoutes } from "@/content/routes";
import { BookingDetail } from "@/features/meetings/components/booking-detail";
import { BOOKING_STATUS_LABELS, formatBookingWhen, type Booking } from "@/features/meetings/contract";
import { LEAD_EVENT_LABELS, type LeadDetail, type LeadEvent } from "../contract";
import { TimelineButtons } from "./lead-actions";

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const stamp = (iso: string) => `${when.format(new Date(iso))} UTC`;
const EMPTY = "—";

type Row = {
  key: string;
  title: string;
  at: string;
  body: string;
  author: string;
  attachment: { name: string; type: string; href: string } | null;
  meeting: Booking | null;
};

/** History for one lead, with each meeting opening the same detail as the calendar. */
export function LeadTimeline({ lead, events, meetings }: { lead: LeadDetail; events: readonly LeadEvent[]; meetings: readonly Booking[] }) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = meetings.find((meeting) => meeting.id === selectedId) ?? null;
  const rows = timelineRows(lead, events, meetings);

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
                {event.meeting ? (
                  <button type="button" onClick={() => setSelectedId(event.meeting?.id ?? null)} className="m-0 min-h-11 cursor-pointer text-left type-label text-action-secondary hover:underline">
                    {event.title}
                  </button>
                ) : (
                  <p className="m-0 type-label text-ink">{event.title}</p>
                )}
                <p className="m-0 whitespace-pre-line type-body-sm text-ink">{event.body}</p>
                {event.attachment && <AttachmentPreview href={event.attachment.href} name={event.attachment.name} type={event.attachment.type} />}
                <p className="m-0 type-body-sm text-ink-muted">
                  <time dateTime={event.at}>{event.meeting ? formatBookingWhen(event.meeting.startsAt, event.meeting.endsAt) : stamp(event.at)}</time>
                  {" · "}
                  {event.author}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card as="section" padding="none">
        <h2 className="m-0 border-b border-border px-4 py-3 type-label">Activity</h2>
        <dl className="m-0 grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
          <Activity label="Discovery call logs" value={callLogs(meetings)} wide />
          <Activity label="Follow-up notes" value={EMPTY} wide />
          <Activity label="Status changes" value={EMPTY} wide />
          <Activity label="Closer changes" value={EMPTY} wide />
          <Activity
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
        </dl>
      </Card>

      {selected && (
        <BookingDetail
          booking={selected}
          canManage
          onClose={() => setSelectedId(null)}
          onEdit={() => undefined}
          onDone={(message) => toast.show({ title: message, tone: "success" })}
        />
      )}
    </div>
  );
}

function timelineRows(lead: LeadDetail, events: readonly LeadEvent[], meetings: readonly Booking[]): Row[] {
  const rows: Row[] = [
    ...events.map((event) => ({
      key: event.id,
      title: LEAD_EVENT_LABELS[event.kind],
      at: event.createdAt,
      body: event.body,
      author: event.authorName,
      attachment: event.attachmentName && event.attachmentType ? { name: event.attachmentName, type: event.attachmentType, href: `${adminLeadHref(lead.id)}/files/${event.id}` } : null,
      meeting: null,
    })),
    ...meetings.map((meeting) => ({
      key: meeting.id,
      title: meeting.title,
      at: meeting.startsAt,
      body: BOOKING_STATUS_LABELS[meeting.status],
      author: meeting.creatorName,
      attachment: null,
      meeting,
    })),
    { key: "enquiry", title: "Lead received", at: lead.createdAt, body: lead.message, author: "Discovery form", attachment: null, meeting: null },
  ];
  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

function callLogs(meetings: readonly Booking[]) {
  if (meetings.length === 0) return EMPTY;
  return meetings.map((meeting) => `${meeting.title} · ${BOOKING_STATUS_LABELS[meeting.status]} · ${formatBookingWhen(meeting.startsAt, meeting.endsAt)}`).join("\n");
}

function Activity({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "min-w-0 sm:col-span-2" : "min-w-0"}>
      <dt className="type-caption text-ink-muted">{label}</dt>
      <dd className={`m-0 whitespace-pre-line break-words type-body-sm ${value === EMPTY ? "text-ink-muted" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
