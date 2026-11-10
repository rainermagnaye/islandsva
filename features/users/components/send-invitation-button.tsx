"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { sendEmployeeInvite } from "../actions";

/**
 * Emails the invite to an employee who hasn't signed in yet: the first one for a profile made with Create,
 * or a new link when the last one expired. The Server Action checks the admin role and the account's state.
 */
export function SendInvitationButton({ userId, name, invited }: { userId: string; name: string; invited: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const label = invited ? "Resend invitation" : "Send invitation";

  async function confirm() {
    setPending(true);
    setError(undefined);
    try {
      // The action re-renders the page (refresh()), so the invite date and badge update on success.
      const result = await sendEmployeeInvite(userId);
      if (result.ok) setSent(true);
      else setError(result.message);
    } catch {
      setError("We couldn't send the invitation. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function close() {
    if (pending) return;
    setOpen(false);
    setSent(false);
    setError(undefined);
  }

  return (
    <>
      <Button size="sm" iconLeft="mail" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={sent ? "Invitation sent" : `${label}?`}
        description={
          sent
            ? `${name} will get an email with a link to choose a password. The link expires in 24 hours.`
            : `${name} will get an email with a link to choose a password.${invited ? " Any earlier link stops working." : ""}`
        }
        footer={
          sent ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={confirm} loading={pending}>
                {pending ? "Sending" : label}
              </Button>
            </>
          )
        }
      >
        {error && <Alert tone="danger" title={error} />}
      </Modal>
    </>
  );
}
