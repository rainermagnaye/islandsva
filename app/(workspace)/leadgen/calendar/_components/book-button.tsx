"use client";

import type { BusyTime } from "@/features/demos/slot-times";
import { addCloserMeeting, addCloserSlots, addCloserTask } from "@/features/meetings/closer-actions";
import { CalendarBookButton } from "@/features/meetings/components/calendar-book-button";
import type { BookingChoice } from "@/features/meetings/contract";
import type { VaMeetingClient } from "@/features/meetings/components/va-meeting-form";

export type CloserBookDraft = { date: string; time?: string };

/** "Book" on the Lead Gen calendar — the same dialog as the VA: demo slots, a meeting or a task. */
export function BookButton({
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
  draft: CloserBookDraft | null;
  onDraftChange: (draft: CloserBookDraft | null) => void;
}) {
  return (
    <CalendarBookButton
      today={today}
      last={last}
      slots={slots}
      clients={clients}
      team={team}
      openTasks={openTasks}
      meetingBook={addCloserMeeting}
      addSlots={addCloserSlots}
      taskBook={addCloserTask}
      defaultDate={draft?.date}
      startTime={draft?.time}
      open={draft !== null}
      onOpenChange={(open) => onDraftChange(open ? (draft ?? { date: today }) : null)}
    />
  );
}
