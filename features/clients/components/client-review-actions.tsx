"use client";

import { useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import type { SubmitResult } from "@/types/form";
import { confirmClientRegistration, returnClientRegistration } from "../actions";
import { CLIENT_REVIEW_NOTE_LIMIT, CLIENT_REVIEW_SECTIONS, CLIENT_REVIEW_SECTION_LABELS, type ClientDetail, type ClientPacketSummary } from "../contract";
import { ClientConsents, ClientInvoices, ClientProfileView } from "./client-profile-view";

/** Review opens the packet. Confirm and return stay inside it, so they are not offered before the details have been read. */
export function ClientReviewActions({ client, packet, menu }: { client: ClientDetail; packet: ClientPacketSummary; menu: ReactNode }) {
  const [reviewing, setReviewing] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setPending(true);
    setError(undefined);
    try {
      const result = await confirmClientRegistration(client.id);
      if (result.ok) setReviewing(false);
      else setError(result.message);
    } catch {
      setError("We couldn't confirm that registration. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function sendBack(formData: FormData): Promise<SubmitResult<"note" | "sections">> {
    formData.set("clientId", client.id);
    try {
      const result = await returnClientRegistration(formData);
      if (result.ok) {
        setOpen(false);
        setReviewing(false);
      }
      return result;
    } catch {
      return { ok: false, message: "We couldn't send that registration back. Check your connection and try again." };
    }
  }

  return (
    <div className="grid justify-items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          onClick={() => {
            setError(undefined);
            setReviewing(true);
          }}
        >
          Review
        </Button>
        {menu}
      </div>
      <Modal open={reviewing} onClose={() => setReviewing(false)} title="Review registration" size="lg">
        <div className="grid gap-4">
          <ClientProfileView client={client} />
          {packet.consentName && <ClientConsents consent={{ name: packet.consentName, signedAt: packet.consentSignedAt }} />}
          {packet.paymentProofName && (
            <ClientInvoices clientId={client.id} proofName={packet.paymentProofName} proofType={packet.paymentProofType} amount={client.monthlyCents} country={client.business.country} />
          )}
          {error && <Alert tone="danger" title={error} />}
          <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(true)} disabled={pending}>
              Return for changes
            </Button>
            <Button type="button" onClick={confirm} loading={pending}>
              {pending ? "Saving" : "Confirm registration"}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Send this registration back?"
        description={`${client.contactName} will see the sections you choose.`}
        footer={
          <>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button type="submit" form="return-registration">
              Send it back
            </Button>
          </>
        }
      >
        <Form id="return-registration" aria-label="Sections to send back" onSubmit={sendBack}>
          {({ pending: sending, fieldErrors }) => (
            <div className="grid gap-3">
              {CLIENT_REVIEW_SECTIONS.map((section) => (
                <Checkbox key={section} name="section" value={section} label={CLIENT_REVIEW_SECTION_LABELS[section]} />
              ))}
              {fieldErrors.sections && <Alert tone="danger" title={fieldErrors.sections} />}
              <TextField label="Note" name="note" optional multiline maxLength={CLIENT_REVIEW_NOTE_LIMIT} placeholder="What should they change?" error={fieldErrors.note} />
              <span className="sr-only">{sending ? "Sending" : ""}</span>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
}
