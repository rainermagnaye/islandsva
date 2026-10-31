"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { answerVaMeetingAction } from "../client-actions";
import type { Booking } from "../contract";

/** On the client's calendar: a meeting their VA asked for, with Accept and Decline. */
export function AnswerMeetingRequest({ booking, onDone }: { booking: Booking; onDone: (message: string) => void }) {
  const answer = (value: "accept" | "decline") => (
    <Form
      aria-label={value === "accept" ? "Accept the meeting" : "Decline the meeting"}
      onSubmit={async (formData) => {
        const result = await answerVaMeetingAction(formData);
        if (result.ok) onDone(value === "accept" ? "Meeting accepted." : "Meeting declined.");
        return result;
      }}
    >
      {({ pending }) => (
        <>
          <input type="hidden" name="meetingId" value={booking.id} />
          <input type="hidden" name="answer" value={value} />
          <Button type="submit" size="sm" variant={value === "accept" ? "primary" : "ghost"} iconLeft={value === "accept" ? "check" : undefined} loading={pending}>
            {value === "accept" ? "Accept" : "Decline"}
          </Button>
        </>
      )}
    </Form>
  );
  return (
    <Alert tone="warning" title={`${booking.creatorName} asked for this meeting`}>
      <div className="mt-2 flex flex-wrap gap-2">
        {answer("accept")}
        {answer("decline")}
      </div>
    </Alert>
  );
}
