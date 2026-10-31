"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { cancelVaMeetingAction } from "../va-actions";
import type { Booking } from "../contract";

/** On the VA's calendar: a meeting they booked, still open. A request says who it's waiting for. */
export function VaMeetingCancel({ booking, onDone }: { booking: Booking; onDone: (message: string) => void }) {
  const waiting = booking.status === "requested";
  return (
    <Alert tone={waiting ? "warning" : "info"} title={waiting ? `Waiting for ${booking.clientName ?? "the client"} to accept` : "You booked this meeting"}>
      <Form
        aria-label="Cancel the meeting"
        className="mt-2"
        onSubmit={async (formData) => {
          const result = await cancelVaMeetingAction(formData);
          if (result.ok) onDone(waiting ? "Request cancelled." : "Meeting cancelled.");
          return result;
        }}
      >
        {({ pending }) => (
          <div>
            <input type="hidden" name="meetingId" value={booking.id} />
            <Button type="submit" size="sm" variant="ghost" loading={pending}>
              {waiting ? "Cancel request" : "Cancel meeting"}
            </Button>
          </div>
        )}
      </Form>
    </Alert>
  );
}
