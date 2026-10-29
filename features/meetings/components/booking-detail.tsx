"use client";

import { useState } from "react";
import { AttachmentField } from "@/components/ui/attachment-field";
import { AttachmentPreview } from "@/components/ui/attachment-preview";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { addDays, todayIn, type IsoDate } from "@/components/ui/date-math";
import { DatePicker } from "@/components/ui/date-picker";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Form } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { meetingFileHref } from "@/content/routes";
import type { SubmitResult } from "@/types/form";
import { BOOKING_ATTACHMENT_ACCEPT, acceptBookingAttachment } from "../attachment";
import { BOOKING_STATUS_LABELS, BOOKING_TIME_ZONE, type Booking, type BookingField, type BookingNoteField } from "../contract";
import { NoteForm } from "./booking-note-form";
import { at, useStarted, clocks, guestNames, Field } from "./booking-detail-parts";

export type BookingDetailActions = {
  cancel: (formData: FormData) => Promise<SubmitResult>;
  complete: (formData: FormData) => Promise<SubmitResult>;
  note: (formData: FormData) => Promise<SubmitResult<BookingNoteField>>;
  editNote?: (formData: FormData) => Promise<SubmitResult<BookingNoteField>>;
  deleteNote?: (formData: FormData) => Promise<SubmitResult>;
  confirmDiscovery?: (formData: FormData) => Promise<SubmitResult>;
  rescheduleDiscovery?: (formData: FormData) => Promise<SubmitResult<BookingField>>;
};

/**
 * A booking's details and notes. The caller passes the Server Actions so admin and client calendars don't
 * ship each other's code. A read-only view (VA calendar) omits them.
 */
export function BookingDetail({ booking, canManage, actions, onClose, onEdit, onDone }: {
  booking: Booking;
  canManage: boolean;
  actions?: BookingDetailActions;
  onClose: () => void;
  onEdit?: () => void;
  onDone: (message: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [dates, setDates] = useState<{ min: IsoDate; max: IsoDate } | null>(null);
  const started = useStarted(booking.startsAt);
  const manage = canManage && actions;
  const editNote = actions?.editNote;
  const deleteNote = actions?.deleteNote;
  const rescheduleDiscovery = actions?.rescheduleDiscovery;
  const editsNotes = Boolean(manage && editNote && deleteNote);
  const discovery = booking.kind === "discovery";
  const openCall = booking.status === "requested" || booking.status === "scheduled";
  const notes = booking.events.filter((event) => event.kind === "note");
  const attachments = notes.filter((note) => note.attachmentName && note.attachmentType);
  const menu: MenuItem[] = !manage ? [] : discovery ? [
    ...(booking.status === "requested" && actions.confirmDiscovery ? [{ label: "Assign to me and confirm", icon: "check" as const, onSelect: claim }] : []),
    ...(openCall && actions.rescheduleDiscovery ? [{ label: "Reschedule", icon: "calendar" as const, onSelect: openReschedule }] : []),
  ] : [
    { label: "Edit", icon: "edit", onSelect: onEdit ?? (() => undefined), disabled: booking.status !== "scheduled" },
    { label: "Cancel meeting", danger: true, onSelect: () => setConfirming(true), disabled: booking.status !== "scheduled" },
  ];

  function openReschedule() {
    const min = todayIn(BOOKING_TIME_ZONE);
    setDates({ min, max: addDays(min, 14) });
    setRescheduling(true);
  }

  async function claim() {
    if (!actions?.confirmDiscovery) return;
    setClaimError(null);
    const data = new FormData();
    data.set("meetingId", booking.id);
    const result = await actions.confirmDiscovery(data);
    if (result.ok) onDone("Meeting confirmed.");
    else setClaimError(result.message);
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={booking.title}
        size="wide"
        actions={menu.length > 0 ? (
          <DropdownMenu label="More" icon="menu" iconOnly align="end" items={menu} />
        ) : undefined}
        footer={manage && booking.status === "scheduled" ? (
          <Form aria-label="Complete booking" className="w-full justify-items-end gap-2" onSubmit={async (formData) => {
            const result = await actions.complete(formData);
            if (result.ok) onDone("Booking completed.");
            return result;
          }}>
            {({ pending }) => (
              <>
                <input type="hidden" name="meetingId" value={booking.id} />
                {!started && <p className="m-0 type-caption text-ink-muted">You can complete this once the meeting has started.</p>}
                <Button type="submit" disabled={!started} loading={pending}>{pending ? "Completing" : "Complete booking"}</Button>
              </>
            )}
          </Form>
        ) : undefined}
      >
        <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label="Starts" value={clocks(booking, booking.startsAt)} />
          <Field label="Ends" value={clocks(booking, booking.endsAt)} />
          <div className="min-w-0">
            <dt className="type-caption text-ink-muted">Status</dt>
            <dd className="m-0 mt-1">
              <Badge tone={booking.status === "done" ? "info" : booking.status === "cancelled" ? "neutral" : booking.status === "requested" ? "warning" : "success"} size="sm" dot>
                {BOOKING_STATUS_LABELS[booking.status]}
              </Badge>
            </dd>
          </div>
          <Field label="Client" value={guestNames(booking, "client")} />
          <Field label="Staff" value={guestNames(booking, "staff")} />
          <Field label="Created by" value={booking.creatorName} />
        </dl>
        {claimError && <Alert tone="danger" title="Couldn't confirm" className="mt-4">{claimError}</Alert>}
        <div className="mt-6 grid gap-4">
          <Card as="section" padding="none">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
              <h3 className="m-0 type-label">Notes</h3>
              {manage && (
                <button
                  type="button"
                  aria-label={adding ? "Close note" : "Add a note"}
                  aria-pressed={adding}
                  onClick={() => setAdding((open) => !open)}
                  className="inline-grid size-11 cursor-pointer place-items-center rounded-md text-ink hover:bg-action-ghost-hover aria-pressed:bg-action-ghost-hover"
                >
                  <Icon name={adding ? "x" : "plus"} />
                </button>
              )}
            </div>
            <div className="grid gap-3 p-4">
              {notes.length === 0 ? (
                <EmptyState compact headingLevel={3} title="No notes yet" description="Notes you add for this meeting show up here." />
              ) : (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {notes.map((note) => (
                    <li key={note.id} className="flex items-start gap-2">
                      {editingId === note.id && editNote ? (
                        <div className="min-w-0 flex-1">
                          <NoteForm eventId={note.id} defaultValue={note.body ?? ""} save={editNote} onDone={() => { setEditingId(null); onDone("Note saved."); }} />
                        </div>
                      ) : (
                        <>
                          <div className="grid min-w-0 flex-1 gap-1">
                            <p className="m-0 whitespace-pre-line type-body-sm">{note.body}</p>
                            <p className="m-0 type-caption text-ink-muted">{note.actorName} · {at.format(new Date(note.createdAt))} PHT</p>
                          </div>
                          {editsNotes && (
                            <DropdownMenu
                              label="Note actions"
                              icon="more"
                              iconOnly
                              align="end"
                              items={[
                                { label: "Edit", icon: "edit", onSelect: () => { setAdding(false); setEditingId(note.id); } },
                                { label: "Delete", icon: "trash", danger: true, onSelect: () => setDeletingId(note.id) },
                              ]}
                            />
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {manage && adding && <NoteForm meetingId={booking.id} save={actions.note} onDone={() => { setAdding(false); onDone("Note added."); }} />}
            </div>
          </Card>
          <Card as="section" padding="none">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
              <h3 className="m-0 type-label">Attachments</h3>
              {manage && (
                <button
                  type="button"
                  aria-label={attaching ? "Close file" : "Add a file"}
                  aria-pressed={attaching}
                  onClick={() => setAttaching((open) => !open)}
                  className="inline-grid size-11 cursor-pointer place-items-center rounded-md text-ink hover:bg-action-ghost-hover aria-pressed:bg-action-ghost-hover"
                >
                  <Icon name={attaching ? "x" : "plus"} />
                </button>
              )}
            </div>
            <div className="grid gap-3 p-4">
              {attachments.length === 0 ? (
                <EmptyState compact headingLevel={3} title="No files yet" description="Files you add show up here." />
              ) : (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {attachments.map((note) => (
                    <li key={note.id}>
                      <AttachmentPreview href={meetingFileHref(note.id)} name={note.attachmentName ?? ""} type={note.attachmentType ?? ""} />
                    </li>
                  ))}
                </ul>
              )}
              {manage && attaching && (
                <Form aria-label="Add a file" onSubmit={async (formData) => {
                  const file = formData.get("attachment");
                  const title = formData.get("attachmentName");
                  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file." };
                  const accepted = acceptBookingAttachment(file, typeof title === "string" ? title : "");
                  if (!accepted.ok) return { ok: false, message: accepted.message };
                  formData.set("meetingId", booking.id);
                  formData.set("note", accepted.name);
                  const result = await actions.note(formData);
                  if (result.ok) {
                    setAttaching(false);
                    onDone("File added.");
                  }
                  return result;
                }}>
                  {({ pending }) => (
                    <div className="grid gap-3">
                      <AttachmentField fileName="attachment" nameField="attachmentName" label="File" accept={BOOKING_ATTACHMENT_ACCEPT} hint="A recording, PDF or image, up to 2 MB." />
                      <div className="flex justify-end">
                        <Button type="submit" size="sm" loading={pending}>{pending ? "Saving" : "Save"}</Button>
                      </div>
                    </div>
                  )}
                </Form>
              )}
            </div>
          </Card>
        </div>
      </Modal>
      {deletingId && deleteNote && (
        <Modal open onClose={() => setDeletingId(null)} title="Delete note" description="Are you sure you want to delete this note?" role="alertdialog">
          <Form aria-label="Delete note" onSubmit={async (formData) => {
            const result = await deleteNote(formData);
            if (result.ok) {
              setDeletingId(null);
              onDone("Note deleted.");
            }
            return result;
          }}>
            {({ pending }) => (
              <>
                <input type="hidden" name="eventId" value={deletingId} />
                <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                  <Button type="button" variant="ghost" onClick={() => setDeletingId(null)} disabled={pending}>Keep it</Button>
                  <Button type="submit" variant="danger" loading={pending}>{pending ? "Deleting" : "Delete note"}</Button>
                </div>
              </>
            )}
          </Form>
        </Modal>
      )}
      {rescheduling && dates && rescheduleDiscovery && (
        <Modal open onClose={() => setRescheduling(false)} title="Reschedule" description="Choose a new time in Philippine time.">
          <Form<BookingField> aria-label="Reschedule discovery call" onSubmit={async (formData) => {
            const result = await rescheduleDiscovery(formData);
            if (result.ok) {
              setRescheduling(false);
              onDone("Meeting rescheduled.");
            }
            return result;
          }}>
            {({ pending, fieldErrors }) => (
              <>
                <input type="hidden" name="meetingId" value={booking.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <DatePicker label="Meeting date" name="startDate" required timeZone={BOOKING_TIME_ZONE} weekStartsOn={1} min={dates.min} max={dates.max} error={fieldErrors.startDate} />
                  <TextField label="Meeting time" name="startTime" type="time" required hint="Philippine time, on the hour or half hour." error={fieldErrors.startTime} />
                </div>
                <div className="mt-4 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                  <Button type="button" variant="ghost" onClick={() => setRescheduling(false)} disabled={pending}>Keep it</Button>
                  <Button type="submit" size="sm" loading={pending}>{pending ? "Saving" : "Reschedule"}</Button>
                </div>
              </>
            )}
          </Form>
        </Modal>
      )}
      {confirming && actions && (
        <Modal open onClose={() => setConfirming(false)} title="Cancel meeting" description="Are you sure you want to cancel this meeting?" role="alertdialog">
          <Form aria-label="Cancel meeting" onSubmit={async (formData) => {
            const result = await actions.cancel(formData);
            if (result.ok) onDone("Meeting cancelled.");
            return result;
          }}>
            {({ pending }) => (
              <>
                <input type="hidden" name="meetingId" value={booking.id} />
                <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                  <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>Keep it</Button>
                  <Button type="submit" variant="danger" loading={pending}>{pending ? "Cancelling" : "Cancel meeting"}</Button>
                </div>
              </>
            )}
          </Form>
        </Modal>
      )}
    </>
  );
}
