"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS_LABELS, formatBookingWhen, type Booking, type BookingGuest, type BookingStatus } from "../contract";

// Small pieces of BookingDetail: the start clock, the time shown in both zones, guest names and a read-only
// field.

export const at = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

/** True once the meeting's start has passed. The clock is read in a timer, not during render. */
export function useStarted(startsAt: string) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const wait = Date.parse(startsAt) - Date.now();
    if (wait >= 2_147_000_000) return;
    const timer = window.setTimeout(() => setStarted(wait <= 0), 0);
    const later = wait > 0 ? window.setTimeout(() => setStarted(true), wait) : undefined;
    return () => {
      window.clearTimeout(timer);
      if (later !== undefined) window.clearTimeout(later);
    };
  }, [startsAt]);
  return started;
}

export function clocks(booking: Booking, iso: string) {
  const pht = `${at.format(new Date(iso))} PHT`;
  if (booking.kind !== "discovery" || !booking.timeZone || booking.timeZone === "Asia/Manila") return pht;
  const local = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: booking.timeZone }).format(new Date(iso));
  return `${local} ${booking.timeZoneCity ?? "local"}\n${pht}`;
}

export function guestNames(booking: Booking, kind: BookingGuest["kind"]) {
  const names = booking.guests.filter((guest) => guest.kind === kind).map((guest) => guest.name);
  if (names.length > 0) return names.join(", ");
  return kind === "client" ? booking.clientName : booking.staffName;
}

export function statusTone(status: BookingStatus) {
  if (status === "done") return "info" as const;
  if (status === "cancelled") return "neutral" as const;
  if (status === "requested") return "warning" as const;
  return "success" as const;
}

export function StatusField({ status }: { status: BookingStatus }) {
  return (
    <div className="min-w-0">
      <dt className="type-caption text-ink-muted">Status</dt>
      <dd className="m-0 mt-1">
        <Badge tone={statusTone(status)} size="sm" dot>
          {BOOKING_STATUS_LABELS[status]}
        </Badge>
      </dd>
    </div>
  );
}

export function WhenFields({ booking }: { booking: Booking }) {
  if (booking.kind === "discovery" && booking.timeZone && booking.timeZone !== "Asia/Manila") {
    return (
      <>
        <Field label="Starts" value={clocks(booking, booking.startsAt)} />
        <Field label="Ends" value={clocks(booking, booking.endsAt)} />
      </>
    );
  }
  return <Field label="When" value={formatBookingWhen(booking.startsAt, booking.endsAt)} />;
}

export function Field({ label, value }: { label: string; value: string | null }) {
  const shown = value?.trim() ? value : "Not provided";
  return (
    <div className="min-w-0">
      <dt className="type-caption text-ink-muted">{label}</dt>
      <dd className={`m-0 whitespace-pre-line type-body-sm ${shown === "Not provided" ? "text-ink-muted" : "text-ink"}`}>{shown}</dd>
    </div>
  );
}
