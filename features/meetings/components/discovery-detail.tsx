"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { addDays, todayIn, type IsoDate } from "@/components/ui/date-math";
import { DatePicker } from "@/components/ui/date-picker";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import {
  BOOKING_LIMITS,
  BOOKING_TIME_ZONE,
  DISCOVERY_LIMITS,
  formatBookingWhen,
  type Booking,
  type BookingField,
  type DiscoveryOutcomeField,
  type DiscoveryRejectField,
  type DiscoveryRequest,
} from "../contract";
import { confirmDiscoveryAction, recordDiscoveryOutcomeAction, rejectDiscoveryAction, rescheduleDiscoveryAction } from "../actions";
import { clocks, Field, StatusField, useStarted } from "./booking-detail-parts";

type Intent = "view" | "reschedule" | "decline" | "done" | "no_show";

/** Confirm, decline or reschedule a requested call, or mark a confirmed one done / no-show after it starts. */
export function DiscoveryDetail({
  request,
  booking,
  personHref,
  personLabel,
  onClose,
  onDone,
}: {
  request?: DiscoveryRequest | null;
  booking?: Booking | null;
  personHref?: string | null;
  personLabel?: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [intent, setIntent] = useState<Intent>("view");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [dates, setDates] = useState<{ min: IsoDate; max: IsoDate } | null>(null);
  const title = request ? request.companyName || request.fullName : booking?.title ?? "Discovery call";
  const startsAt = request?.startsAt ?? booking?.startsAt ?? "";
  const endsAt = request?.endsAt ?? booking?.endsAt ?? "";
  const when = startsAt && endsAt ? formatBookingWhen(startsAt, endsAt) : null;
  const scheduled = booking?.status === "scheduled";
  const requested = Boolean(request);
  const started = useStarted(startsAt);
  const meetingId = request?.meetingId ?? booking?.id ?? "";
  const status = request ? "requested" as const : booking?.status ?? "requested";
  const dualZone = Boolean(booking?.kind === "discovery" && booking.timeZone && booking.timeZone !== "Asia/Manila");
  const viewing = intent === "view";
  const hasActions = Boolean((personHref && personLabel) || requested || scheduled);

  function openReschedule() {
    const min = todayIn(BOOKING_TIME_ZONE);
    setDates({ min, max: addDays(min, 14) });
    setIntent("reschedule");
  }

  async function claim() {
    setClaimError(null);
    const data = new FormData();
    data.set("meetingId", meetingId);
    const result = await confirmDiscoveryAction(data);
    if (result.ok) onDone("Meeting confirmed.");
    else setClaimError(result.message);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={dualZone ? undefined : (when ?? undefined)}
      footer={viewing && hasActions ? (
        <>
          {personHref && personLabel ? <Button href={personHref} variant="secondary">{personLabel}</Button> : null}
          {requested ? (
            <>
              <Button type="button" variant="ghost" onClick={() => setIntent("decline")}>Decline</Button>
              <Button type="button" variant="secondary" onClick={openReschedule}>Reschedule</Button>
              <Button type="button" onClick={claim}>Assign to me and confirm</Button>
            </>
          ) : null}
          {scheduled ? (
            <>
              <Button type="button" variant="ghost" onClick={openReschedule}>Reschedule</Button>
              <Button type="button" variant="secondary" onClick={() => setIntent("no_show")} disabled={!started}>No-show</Button>
              <Button type="button" onClick={() => setIntent("done")} disabled={!started}>Mark as done</Button>
            </>
          ) : null}
        </>
      ) : undefined}
    >
      {viewing && (
        <div className="grid gap-4">
          <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {request ? (
              <>
                <Field label="Name" value={request.fullName} />
                <Field label="Company" value={request.companyName} />
              </>
            ) : null}
            {booking && dualZone ? (
              <>
                <Field label="Starts" value={clocks(booking, booking.startsAt)} />
                <Field label="Ends" value={clocks(booking, booking.endsAt)} />
              </>
            ) : null}
            {booking && !request ? <Field label="Company" value={booking.clientName} /> : null}
            {booking?.staffName ? <Field label="Staff" value={booking.staffName} /> : null}
            <StatusField status={status} />
          </dl>
          {claimError && <Alert tone="danger" title="Couldn't confirm">{claimError}</Alert>}
          {scheduled && !started && (
            <p className="m-0 type-caption text-ink-muted">You can mark this once the meeting has started.</p>
          )}
        </div>
      )}
      {intent === "reschedule" && dates && (
        <RescheduleForm meetingId={meetingId} dates={dates} onCancel={() => setIntent("view")} onDone={onDone} />
      )}
      {intent === "decline" && (
        <DeclineForm meetingId={meetingId} onCancel={() => setIntent("view")} onDone={onDone} />
      )}
      {(intent === "done" || intent === "no_show") && (
        <OutcomeForm meetingId={meetingId} outcome={intent} started={started} onCancel={() => setIntent("view")} onDone={onDone} />
      )}
    </Modal>
  );
}

function RescheduleForm({
  meetingId,
  dates,
  onCancel,
  onDone,
}: {
  meetingId: string;
  dates: { min: IsoDate; max: IsoDate };
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  return (
    <Form<BookingField> aria-label="Reschedule discovery call" onSubmit={async (formData) => {
      const result = await rescheduleDiscoveryAction(formData);
      if (result.ok) onDone("Meeting rescheduled.");
      return result;
    }}>
      {({ pending, fieldErrors }) => (
        <>
          <input type="hidden" name="meetingId" value={meetingId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <DatePicker label="Meeting date" name="startDate" required timeZone={BOOKING_TIME_ZONE} weekStartsOn={1} min={dates.min} max={dates.max} error={fieldErrors.startDate} />
            <TextField label="Meeting time" name="startTime" type="time" required hint="Philippine time, on the hour or half hour." error={fieldErrors.startTime} />
          </div>
          <div className="mt-4 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>Back</Button>
            <Button type="submit" loading={pending}>{pending ? "Saving" : "Reschedule"}</Button>
          </div>
        </>
      )}
    </Form>
  );
}

function DeclineForm({
  meetingId,
  onCancel,
  onDone,
}: {
  meetingId: string;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  return (
    <Form<DiscoveryRejectField> aria-label="Decline discovery call" onSubmit={async (formData) => {
      const result = await rejectDiscoveryAction(formData);
      if (result.ok) onDone("Call declined.");
      return result;
    }}>
      {({ pending, fieldErrors }) => (
        <>
          <input type="hidden" name="meetingId" value={meetingId} />
          <TextField
            label="Reason"
            name="reason"
            multiline
            required
            maxLength={DISCOVERY_LIMITS.rejectReason}
            hint="This closes the enquiry as junk."
            error={fieldErrors.reason}
          />
          <div className="mt-4 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>Back</Button>
            <Button type="submit" variant="danger" loading={pending}>{pending ? "Declining" : "Decline call"}</Button>
          </div>
        </>
      )}
    </Form>
  );
}

function OutcomeForm({
  meetingId,
  outcome,
  started,
  onCancel,
  onDone,
}: {
  meetingId: string;
  outcome: "done" | "no_show";
  started: boolean;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const done = outcome === "done";
  return (
    <Form<DiscoveryOutcomeField>
      aria-label={done ? "Mark discovery call done" : "Mark discovery call as a no-show"}
      onSubmit={async (formData) => {
        const result = await recordDiscoveryOutcomeAction(formData);
        if (result.ok) onDone(done ? "Call marked as done." : "Call marked as a no-show.");
        return result;
      }}
    >
      {({ pending, fieldErrors }) => (
        <>
          <input type="hidden" name="meetingId" value={meetingId} />
          <input type="hidden" name="outcome" value={outcome} />
          <TextField
            label="Note"
            name="note"
            multiline
            optional
            maxLength={BOOKING_LIMITS.note}
            error={fieldErrors.note}
          />
          <div className="mt-4 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>Back</Button>
            <Button type="submit" variant={done ? "primary" : "secondary"} disabled={!started} loading={pending}>
              {pending ? "Saving" : done ? "Mark as done" : "Mark as no-show"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
