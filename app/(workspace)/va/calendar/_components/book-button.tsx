"use client";

import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cx } from "@/lib/cx";
import type { BusyTime } from "@/features/demos/slot-times";
import type { BookingChoice } from "@/features/meetings/contract";
import type { VaMeetingClient } from "@/features/meetings/components/va-meeting-form";

// The three book forms (DatePicker, Select, TextField, their actions) stay off /va/calendar's first load;
// they download when the VA picks a kind. Inlined they push the page over its 169 KB cap.
const AddSlotsForm = lazy(() => import("@/features/demos/components/add-slots-form").then((m) => ({ default: m.AddSlotsForm })));
const VaMeetingForm = lazy(() => import("@/features/meetings/components/va-meeting-form").then((m) => ({ default: m.VaMeetingForm })));
const VaTaskForm = lazy(() => import("@/features/tasks/components/va-task-form").then((m) => ({ default: m.VaTaskForm })));

type Kind = "slots" | "meeting" | "task";

const KINDS: readonly { value: Kind; label: string }[] = [
  { value: "slots", label: "Demo slots" },
  { value: "meeting", label: "Meeting" },
  { value: "task", label: "Task" },
];

export type BookProps = {
  today: string;
  last: string;
  slots: { busy: readonly BusyTime[]; offered: readonly string[]; windows: readonly { weekday: number; startMinute: number; endMinute: number }[] };
  clients: readonly VaMeetingClient[];
  team: readonly BookingChoice[];
  openTasks: readonly BookingChoice[];
};

/** "Book" opens one dialog. The kind — demo slots, a meeting or a task — is chosen on the form. */
export function BookButton({ today, last, slots, clients, team, openTasks }: BookProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("slots");
  const [formKey, setFormKey] = useState(0);
  const choose = (next: Kind) => {
    if (next === kind) return;
    setFormKey((key) => key + 1);
    setKind(next);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        iconLeft="plus"
        onClick={() => {
          setKind("slots");
          setFormKey((key) => key + 1);
          setOpen(true);
        }}
      >
        Book
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} size="wide" title="Book">
        {open && (
          <div className="grid gap-4">
            <fieldset className="m-0 grid gap-2 border-0 p-0 sm:grid-cols-3">
              <legend className="sr-only">What are you booking?</legend>
              {KINDS.map((item) => (
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
              {kind === "slots" && <AddSlotsForm key={formKey} today={today} last={last} {...slots} onAdded={() => setOpen(false)} />}
              {kind === "meeting" && <VaMeetingForm key={formKey} today={today} last={last} clients={clients} team={team} onDone={() => setOpen(false)} />}
              {kind === "task" && (
                <VaTaskForm key={formKey} today={today} last={last} clients={clients.map((client) => ({ id: client.id, label: client.label }))} tasks={openTasks} onDone={() => setOpen(false)} />
              )}
            </Suspense>
          </div>
        )}
      </Modal>
    </>
  );
}
