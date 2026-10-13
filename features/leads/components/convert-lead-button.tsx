"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { convertLead } from "../actions";
import { CONVERT_LIMITS, type ConvertField } from "../contract";

type ConvertLeadButtonProps = { lead: { id: string; fullName: string; companyName: string | null } };

/**
 * "Convert" on a lead row: confirms the client's company and contact names in a dialog, then creates the
 * client. On success the server re-renders the list, where the row now shows "Converted".
 */
export function ConvertLeadButton({ lead }: ConvertLeadButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Convert
      </Button>
      {/* Mounted only while open: one dialog in the DOM at a time, so field ids stay unique. */}
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Convert to client"
          description={`Creates a pending client from ${lead.fullName}'s enquiry, with their email and message. Inviting them to sign in comes with onboarding.`}
        >
          <Form<ConvertField> aria-label="Convert to client" onSubmit={convertLead}>
            {({ pending, fieldErrors }) => (
              <>
                <input type="hidden" name="leadId" value={lead.id} />
                <TextField
                  label="Company"
                  name="companyName"
                  required
                  defaultValue={lead.companyName ?? ""}
                  maxLength={CONVERT_LIMITS.companyName}
                  autoComplete="off"
                  data-autofocus
                  error={fieldErrors.companyName}
                />
                <TextField
                  label="Contact name"
                  name="contactName"
                  required
                  defaultValue={lead.fullName}
                  maxLength={CONVERT_LIMITS.contactName}
                  autoComplete="off"
                  error={fieldErrors.contactName}
                />
                <TextField
                  label="Contact phone"
                  name="contactPhone"
                  type="tel"
                  optional
                  maxLength={CONVERT_LIMITS.contactPhone}
                  autoComplete="off"
                  error={fieldErrors.contactPhone}
                />
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={pending}>
                    {pending ? "Converting" : "Create client"}
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
