"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { sendClientActivation } from "../actions";

/** The password invite, shown once the review is finished. */
export function SendActivation({ clientId, email }: { clientId: string; email: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Send activation
      </Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Send activation" description={`${email} will get a link to set a password and open their account.`}>
          <Form
            aria-label="Send activation"
            onSubmit={async (formData) => {
              const result = await sendClientActivation(formData);
              if (result.ok) setOpen(false);
              return result;
            }}
          >
            {({ pending }) => (
              <>
                <input type="hidden" name="clientId" value={clientId} />
                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={pending}>
                    {pending ? "Sending" : "Send activation"}
                  </Button>
                </div>
              </>
            )}
          </Form>
        </Modal>
      )}
    </>
  );
}
