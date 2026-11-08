"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { clockLabel, convertWallClock } from "@/components/ui/date-math";
import { DatePicker } from "@/components/ui/date-picker";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import type { SubmitResult } from "@/types/form";
import { addVaMeeting } from "../va-actions";
import { BOOKING_LIMITS, BOOKING_TIME_ZONE, VA_MEETING_LENGTHS, type BookingChoice, type BookingGuest, type VaMeetingField } from "../contract";
import { InviteField } from "./invite-field";

/** A client the VA, Lead Gen or admin works with, and the zone their clock is shown in. */
export type VaMeetingClient = BookingChoice & { timezone: string | null; active?: boolean };

const START_TIMES = Array.from({ length: 48 }, (_, index) => {
  const minutes = index * 30;
  return { value: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 ? "30" : "00"}`, label: clockLabel(minutes) };
});
const LENGTHS = VA_MEETING_LENGTHS.map((minutes) => ({ value: String(minutes), label: lengthLabel(minutes) }));

function lengthLabel(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/**
 * "Book › Meeting" on the VA, Lead Gen or admin calendar. Invite a client (they accept if the company is active)
 * and/or team members. Times are Manila; an invited client's own clock is shown beside them.
 */
export function VaMeetingForm({
  clients,
  team,
  today,
  last,
  onDone,
  book = addVaMeeting,
  startTime = "10:00",
  defaultDate,
}: {
  clients: readonly VaMeetingClient[];
  team: readonly BookingChoice[];
  today: string;
  last: string;
  onDone?: () => void;
  book?: (formData: FormData) => Promise<SubmitResult<VaMeetingField>>;
  startTime?: string;
  defaultDate?: string;
}) {
  const [guests, setGuests] = useState<BookingGuest[]>([]);
  const [date, setDate] = useState(defaultDate ?? today);
  const [start, setStart] = useState(startTime);
  const invited = guests.find((guest) => guest.kind === "client");
  const client = invited ? (clients.find((item) => item.id === invited.id) ?? { id: invited.id, label: invited.name, timezone: null, active: true }) : null;
  const waiting = Boolean(client && client.active !== false);
  const theirs = client?.timezone && client.timezone !== BOOKING_TIME_ZONE ? convertWallClock(`${date}T${start}`, BOOKING_TIME_ZONE, client.timezone) : null;

  return (
    <Form<VaMeetingField>
      aria-label="Book a meeting"
      className="gap-4"
      onSubmit={async (formData) => {
        const result = await book(formData);
        if (result.ok) onDone?.();
        return result;
      }}
    >
      {({ pending, fieldErrors }) => (
        <>
          <TextField label="Title" name="title" required maxLength={BOOKING_LIMITS.title} error={fieldErrors.title} />
          <InviteField
            clients={clients}
            staff={team}
            guests={[]}
            error={fieldErrors.clientId ?? fieldErrors.staffIds}
            onChange={setGuests}
          />
          <div className="grid gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,1fr)]">
            <DatePicker label="Date" name="date" required min={today} max={last} value={date} onChange={(next) => next && setDate(next)} timeZone={BOOKING_TIME_ZONE} error={fieldErrors.date} />
            <Select label="Starts (Manila)" name="startTime" value={start} onChange={(event) => setStart(event.target.value)} options={START_TIMES} error={fieldErrors.startTime} />
            <Select label="Length" name="minutes" defaultValue="30" options={LENGTHS} error={fieldErrors.minutes} />
          </div>
          {theirs && (
            <p className="m-0 type-body-sm text-ink-muted">
              That&apos;s {clockLabel(Number(theirs.time.slice(0, 2)) * 60 + Number(theirs.time.slice(3, 5)))}
              {theirs.date !== date ? ` on ${theirs.date}` : ""} for {client?.label}.
            </p>
          )}
          <TextField label="Agenda" name="note" multiline rows={3} optional maxLength={BOOKING_LIMITS.note} error={fieldErrors.note} />
          {waiting ? (
            <Alert tone="info" title={`${client?.label} needs to accept`}>
              The slot stays requested on both calendars until they confirm or decline.
            </Alert>
          ) : (
            <p className="m-0 type-body-sm text-ink-muted">
              {client ? `${client.label} has no login yet, so this is booked right away.` : "No client, so it's booked right away and your guests see it on their calendars."}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" iconLeft={waiting ? "arrow-right" : "plus"} loading={pending}>
              {pending ? "Booking" : waiting ? "Send request" : "Book meeting"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
