"use client";

import { addDemoSlots } from "@/features/demos/actions";
import { CalendarBookButton, type CalendarBookProps } from "@/features/meetings/components/calendar-book-button";
import { addVaMeeting } from "@/features/meetings/va-actions";
import { bookVaTaskAction } from "@/features/tasks/actions";

/** "Book" on the VA calendar: demo slots, a meeting or a task. */
export function BookButton(props: CalendarBookProps) {
  return <CalendarBookButton {...props} meetingBook={addVaMeeting} addSlots={addDemoSlots} taskBook={bookVaTaskAction} />;
}
