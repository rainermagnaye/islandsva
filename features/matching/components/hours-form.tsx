"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { WEEKDAYS, formatMinutes, minuteOptions, type WorkingWindow } from "../contract";
import { removeHours, saveHours } from "../actions";

const dayName = new Map<number, string>(WEEKDAYS.map((day) => [day.value, day.label]));

/** One window per weekday, on the half hour. Times are Philippine time. */
export function HoursForm({ windows }: { windows: readonly WorkingWindow[] }) {
  return (
    <div className="grid gap-6">
      {windows.length > 0 && (
        <ul className="m-0 grid list-none gap-2 p-0">
          {windows.map((window) => (
            <li key={window.id} className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 type-body-sm text-ink">
                <span className="type-label">{dayName.get(window.weekday)}</span>
                <span className="text-ink-muted">
                  {" "}
                  · {formatMinutes(window.startMinute)}–{formatMinutes(window.endMinute)} PHT
                </span>
              </p>
              <Form aria-label={`Remove ${dayName.get(window.weekday)}`} onSubmit={removeHours}>
                {({ pending }) => (
                  <>
                    <input type="hidden" name="weekday" value={window.weekday} />
                    <Button type="submit" variant="ghost" size="sm" loading={pending}>
                      Remove
                    </Button>
                  </>
                )}
              </Form>
            </li>
          ))}
        </ul>
      )}
      <Form<"weekday" | "startMinute" | "endMinute"> aria-label="Save working hours" onSubmit={saveHours} className="gap-4">
        {({ pending, fieldErrors }) => (
          <>
            <Select compact label="Day" name="weekday" required placeholder="Choose a day" options={WEEKDAYS.map((day) => ({ value: String(day.value), label: day.label }))} error={fieldErrors.weekday} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select compact label="Start" name="startMinute" required placeholder="Start" options={minuteOptions(false)} error={fieldErrors.startMinute} />
              <Select compact label="End" name="endMinute" required placeholder="End" options={minuteOptions(true)} error={fieldErrors.endMinute} />
            </div>
            <p className="m-0 type-caption text-ink-muted">Philippine time. Saving a day you already set replaces that window.</p>
            <div>
              <Button type="submit" loading={pending}>
                {pending ? "Saving" : "Save hours"}
              </Button>
            </div>
          </>
        )}
      </Form>
    </div>
  );
}
