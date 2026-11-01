"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { cancelCloserMeetingAction } from "../closer-actions";
import type { Booking } from "../contract";

/** On the closer's calendar: cancel a meeting they booked that is still open. */
export function CloserMeetingCancel({ booking, onDone }: { booking: Booking; onDone: (message: string) => void }) {
  const waiting = booking.status === "requested";
  return (
    <Form
      aria-label="Cancel the meeting"
      className="gap-0"
      onSubmit={async (formData) => {
        const result = await cancelCloserMeetingAction(formData);
        if (result.ok) onDone(waiting ? "Request cancelled." : "Meeting cancelled.");
        return result;
      }}
    >
      {({ pending }) => (
        <>
          <input type="hidden" name="meetingId" value={booking.id} />
          <Button type="submit" variant="ghost" loading={pending}>
            {waiting ? "Cancel request" : "Cancel meeting"}
          </Button>
        </>
      )}
    </Form>
  );
}
