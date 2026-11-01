"use client";

import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cx } from "@/lib/cx";
import type { BusyTime } from "@/features/demos/slot-times";
import type { SlotField } from "@/features/demos/contract";
import type { VaTaskField } from "@/features/tasks/contract";
import type { SubmitResult } from "@/types/form";
import type { BookingChoice, VaMeetingField } from "../contract";
import type { VaMeetingClient } from "./va-meeting-form";

// The three book forms stay off the calendar's first load; they download when a kind is picked.
const AddSlotsForm = lazy(() => import("@/features/demos/components/add-slots-form").then((module) => ({ default: module.AddSlotsForm })));
const VaMeetingForm = lazy(() => import("./va-meeting-form").then((module) => ({ default: module.VaMeetingForm })));
const VaTaskForm = lazy(() => import("@/features/tasks/components/va-task-form").then((module) => ({ default: module.VaTaskForm })));

type Kind = "slots" | "meeting" | "task";

const KINDS: readonly { value: Kind; label: string }[] = [
  { value: "slots", label: "Demo slots" },
  { value: "meeting", label: "Meeting" },
  { value: "task", label: "Task" },
];

export type CalendarBookProps = {
  today: string;
  last: string;
  slots: { busy: readonly BusyTime[]; offered: readonly string[]; windows: readonly { weekday: number; startMinute: number; endMinute: number }[] };
  clients: readonly VaMeetingClient[];
  team: readonly BookingChoice[];
  openTasks: readonly BookingChoice[];
  meetingBook?: (formData: FormData) => Promise<SubmitResult<VaMeetingField>>;
  addSlots?: (formData: FormData) => Promise<SubmitResult<SlotField>>;
  taskBook?: (formData: FormData) => Promise<SubmitResult<VaTaskField>>;
  defaultDate?: string;
  startTime?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** "Book" opens one dialog. The kind — demo slots, a meeting or a task — is chosen on the form. */
export function CalendarBookButton({
  today,
  last,
  slots,
  clients,
  team,
  openTasks,
  meetingBook,
  addSlots,
  taskBook,
  defaultDate,
  startTime,
  open: openProp,
  onOpenChange,
}: CalendarBookProps) {
  const controlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? openProp : internalOpen;
  const date = defaultDate ?? today;
  const time = startTime ?? "10:00";

  function setOpen(next: boolean) {
    if (controlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  return (
    <>
      <Button type="button" variant="ghost" iconLeft="plus" onClick={() => setOpen(true)}>
        Book
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} size="wide" title="Book">
        {open && (
          <BookDialog
            today={today}
            last={last}
            date={date}
            time={time}
            startTime={startTime}
            slots={slots}
            clients={clients}
            team={team}
            openTasks={openTasks}
            meetingBook={meetingBook}
            addSlots={addSlots}
            taskBook={taskBook}
            onClose={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}

function BookDialog({
  today,
  last,
  date,
  time,
  startTime,
  slots,
  clients,
  team,
  openTasks,
  meetingBook,
  addSlots,
  taskBook,
  onClose,
}: {
  today: string;
  last: string;
  date: string;
  time: string;
  startTime?: string;
  slots: CalendarBookProps["slots"];
  clients: readonly VaMeetingClient[];
  team: readonly BookingChoice[];
  openTasks: readonly BookingChoice[];
  meetingBook?: CalendarBookProps["meetingBook"];
  addSlots?: CalendarBookProps["addSlots"];
  taskBook?: CalendarBookProps["taskBook"];
  onClose: () => void;
}) {
  const kinds = KINDS.filter((item) => {
    if (item.value === "slots") return Boolean(addSlots);
    if (item.value === "meeting") return Boolean(meetingBook);
    return Boolean(taskBook) && openTasks.length > 0;
  });
  const [kind, setKind] = useState<Kind>(kinds[0]?.value ?? "meeting");
  const [formKey, setFormKey] = useState(0);

  function choose(next: Kind) {
    if (next === kind) return;
    setFormKey((key) => key + 1);
    setKind(next);
  }

  return (
    <div className="grid gap-4">
      <fieldset className={cx("m-0 grid gap-2 border-0 p-0", kinds.length > 1 && "sm:grid-cols-3")}>
        <legend className="sr-only">What are you booking?</legend>
        {kinds.map((item) => (
          <label
            key={item.value}
            className={cx("flex cursor-pointer items-center gap-2.5 rounded-md border p-3", kind === item.value ? "border-action-secondary bg-status-info-bg" : "border-border")}
          >
            <input type="radio" name="book-kind" checked={kind === item.value} onChange={() => choose(item.value)} className="size-4" />
            <span className="type-label text-ink">{item.label}</span>
          </label>
        ))}
      </fieldset>
      <Suspense fallback={null}>
        {kind === "slots" && (
          <AddSlotsForm
            key={`${formKey}-slots`}
            today={today}
            last={last}
            defaultDate={date}
            defaultTimes={startTime ? [startTime] : undefined}
            {...(addSlots ? { save: addSlots } : {})}
            {...slots}
            onAdded={onClose}
          />
        )}
        {kind === "meeting" && (
          <VaMeetingForm
            key={`${formKey}-meeting`}
            today={today}
            last={last}
            defaultDate={date}
            startTime={time}
            clients={clients}
            team={team}
            {...(meetingBook ? { book: meetingBook } : {})}
            onDone={onClose}
          />
        )}
        {kind === "task" && (
          <VaTaskForm
            key={`${formKey}-task`}
            today={today}
            last={last}
            clients={clients.map((client) => ({ id: client.id, label: client.label }))}
            tasks={openTasks}
            {...(taskBook ? { book: taskBook } : {})}
            onDone={onClose}
          />
        )}
      </Suspense>
    </div>
  );
}
