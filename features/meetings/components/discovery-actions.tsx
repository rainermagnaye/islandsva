"use client";

import { Button } from "@/components/ui/button";
import { addDays, todayIn } from "@/components/ui/date-math";
import { DatePicker } from "@/components/ui/date-picker";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { BOOKING_TIME_ZONE, type BookingField } from "../contract";
import { confirmDiscoveryAction, rescheduleDiscoveryAction } from "../actions";

/** Claim a requested discovery call, or move it to another time. */
export function DiscoveryActions({ meetingId, canConfirm, onDone }: { meetingId: string; canConfirm: boolean; onDone: (message: string) => void }) {
  return (
    <div className="grid gap-4">
      {canConfirm && (
        <Form aria-label="Confirm discovery call" onSubmit={async (formData) => {
          const result = await confirmDiscoveryAction(formData);
          if (result.ok) onDone("Meeting confirmed.");
          return result;
        }}>
          {({ pending }) => (
            <>
              <input type="hidden" name="meetingId" value={meetingId} />
              <Button type="submit" loading={pending}>{pending ? "Confirming" : "Assign to me and confirm"}</Button>
            </>
          )}
        </Form>
      )}
      <Form<BookingField> aria-label="Reschedule discovery call" onSubmit={async (formData) => {
        const result = await rescheduleDiscoveryAction(formData);
        if (result.ok) onDone("Meeting rescheduled.");
        return result;
      }}>
        {({ pending, fieldErrors }) => (
          <div className="grid gap-4 rounded-lg border border-border p-4">
            <input type="hidden" name="meetingId" value={meetingId} />
            <p className="m-0 type-label">Reschedule</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <DatePicker label="Meeting date" name="startDate" required timeZone={BOOKING_TIME_ZONE} weekStartsOn={1} min={todayIn(BOOKING_TIME_ZONE)} max={addDays(todayIn(BOOKING_TIME_ZONE), 14)} error={fieldErrors.startDate} />
              <TextField label="Meeting time" name="startTime" type="time" required hint="Philippine time, on the hour or half hour." error={fieldErrors.startTime} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="secondary" size="sm" loading={pending}>{pending ? "Saving" : "Reschedule"}</Button>
            </div>
          </div>
        )}
      </Form>
    </div>
  );
}
