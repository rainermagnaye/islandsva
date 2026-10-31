"use client";

import { lazy, Suspense, useState } from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import type { IconName } from "@/types/icon";
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

const KINDS: readonly { value: Kind; label: string; hint: string; icon: IconName }[] = [
  { value: "slots", label: "Demo slots", hint: "Times clients can book a demo", icon: "calendar" },
  { value: "meeting", label: "Meeting", hint: "With a client (they accept first) or your team", icon: "users" },
  { value: "task", label: "Task", hint: "Add a task or block time to work on one", icon: "check" },
];

export type BookProps = {
  today: string;
  last: string;
  slots: { busy: readonly BusyTime[]; offered: readonly string[]; windows: readonly { weekday: number; startMinute: number; endMinute: number }[] };
  clients: readonly VaMeetingClient[];
  team: readonly BookingChoice[];
  openTasks: readonly BookingChoice[];
};

/** "Book" in the calendar header: pick demo slots, a meeting or a task; each opens in one "Book" dialog. */
export function BookButton({ today, last, slots, clients, team, openTasks }: BookProps) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [formKey, setFormKey] = useState(0);
  const open = (next: Kind) => {
    setFormKey((key) => key + 1);
    setKind(next);
  };
  const close = () => setKind(null);

  return (
    <>
      <DropdownMenu label="Book" icon="plus" align="end" items={KINDS.map((item) => ({ label: item.label, hint: item.hint, icon: item.icon, onSelect: () => open(item.value) }))} />
      <Modal open={kind !== null} onClose={close} size="wide" title="Book">
        {kind && (
          <div className="grid gap-4">
            <fieldset className="m-0 grid gap-2 border-0 p-0 sm:grid-cols-3">
              <legend className="sr-only">What are you booking?</legend>
              {KINDS.map((item) => (
                <label
                  key={item.value}
                  className={cx("flex cursor-pointer items-start gap-2.5 rounded-md border p-3", kind === item.value ? "border-action-secondary bg-status-info-bg" : "border-border")}
                >
                  <input type="radio" name="book-kind" checked={kind === item.value} onChange={() => open(item.value)} className="mt-0.5 size-4" />
                  <span className="grid gap-0.5">
                    <span className="type-label text-ink">{item.label}</span>
                    <span className="type-body-sm text-ink-muted">{item.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <Suspense fallback={null}>
              {kind === "slots" && <AddSlotsForm key={formKey} today={today} last={last} {...slots} onAdded={close} />}
              {kind === "meeting" && <VaMeetingForm key={formKey} today={today} last={last} clients={clients} team={team} onDone={close} />}
              {kind === "task" && (
                <VaTaskForm key={formKey} today={today} last={last} clients={clients.map((client) => ({ id: client.id, label: client.label }))} tasks={openTasks} onDone={close} />
              )}
            </Suspense>
          </div>
        )}
      </Modal>
    </>
  );
}
