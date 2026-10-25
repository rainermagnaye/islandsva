"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { decideDemoAction } from "../booking-actions";
import { DEMO_LIMITS } from "../contract";

/** Declines a demo request with an optional reason the client sees. Loaded only when the VA clicks Decline. */
export function DeclineDemoDialog({ bookingId, companyName, onClose }: { bookingId: string; companyName: string; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Decline this demo?" description={`${companyName} will be asked to pick another time.`}>
      <Form<"reason">
        aria-label="Decline the demo"
        onSubmit={async (formData) => {
          const result = await decideDemoAction(formData);
          if (result.ok) onClose();
          return result;
        }}
      >
        {({ pending, fieldErrors }) => (
          <>
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="decision" value="rejected" />
            <TextField
              label="Reason for the client"
              name="reason"
              multiline
              optional
              maxLength={DEMO_LIMITS.reason}
              hint="Shown to the client, e.g. that you're fully booked that week."
              data-autofocus
              error={fieldErrors.reason}
            />
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Keep it
              </Button>
              <Button type="submit" variant="secondary" loading={pending}>
                {pending ? "Declining" : "Decline"}
              </Button>
            </div>
          </>
        )}
      </Form>
    </Modal>
  );
}
