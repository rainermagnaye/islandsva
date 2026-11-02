"use client";

import type { BusyTime } from "@/features/demos/slot-times";
import { addAdminMeeting, addAdminSlots, addAdminTask } from "../actions";
import { CalendarBookButton } from "./calendar-book-button";
import type { BookingChoice } from "../contract";
import type { VaMeetingClient } from "./va-meeting-form";

export type AdminBookDraft = { date: string; time?: string };

/** "Book" on the admin calendar — the same dialog as the VA and Lead Gen: demo slots, a meeting or a task. */
export function AdminBookButton({
  today,
  last,
  slots,
  clients,
  team,
  openTasks,
  draft,
  onDraftChange,
}: {
  today: string;
  last: string;
  slots: { busy: readonly BusyTime[]; offered: readonly string[]; windows: readonly { weekday: number; startMinute: number; endMinute: number }[] };
  clients: readonly VaMeetingClient[];
  team: readonly BookingChoice[];
  openTasks: readonly BookingChoice[];
  draft: AdminBookDraft | null;
  onDraftChange: (draft: AdminBookDraft | null) => void;
}) {
  return (
    <CalendarBookButton
      today={today}
      last={last}
      slots={slots}
      clients={clients}
      team={team}
      openTasks={openTasks}
      meetingBook={addAdminMeeting}
      addSlots={addAdminSlots}
      taskBook={addAdminTask}
      defaultDate={draft?.date}
      startTime={draft?.time}
      open={draft !== null}
      onOpenChange={(open) => onDraftChange(open ? (draft ?? { date: today }) : null)}
    />
  );
}
