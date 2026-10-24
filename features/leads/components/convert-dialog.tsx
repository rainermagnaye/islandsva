"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { PackageFields } from "@/features/clients/components/package-fields";
import { convertLeadNoted } from "../actions";
import { CONVERT_LIMITS, LEAD_EVENT_LIMIT, type LeadDetail } from "../contract";

/** Confirm the client and the package, then convert. The price is the catalogue price for that term. */
export function ConvertDialog({ lead, onClose }: { lead: LeadDetail; onClose: () => void }) {
  const [problem, setProblem] = useState<string | null>(null);

  if (problem) {
    return <ErrorDialog title="Couldn't convert" message={problem} onClose={() => { setProblem(null); onClose(); }} />;
  }

  return (
    <Modal open onClose={onClose} title="Convert to client" description="Confirm who they are and the package they'll start on. This adds a pending client and starts registration.">
      <Form aria-label="Convert to client" onSubmit={async (formData) => {
        const result = await convertLeadNoted(formData);
        if (result.ok) {
          onClose();
          return result;
        }
        if (result.fieldErrors) return result;
        setProblem(result.message);
        return { ok: true };
      }}>
        {({ pending, fieldErrors }) => (
          <>
            <input type="hidden" name="leadId" value={lead.id} />
            <TextField label="Company" name="companyName" required defaultValue={lead.companyName ?? ""} maxLength={CONVERT_LIMITS.companyName} data-autofocus error={fieldErrors.companyName} />
            <TextField label="Contact name" name="contactName" required defaultValue={lead.fullName} maxLength={CONVERT_LIMITS.contactName} error={fieldErrors.contactName} />
            <TextField label="Contact phone" name="contactPhone" type="tel" optional maxLength={CONVERT_LIMITS.contactPhone} error={fieldErrors.contactPhone} />
            <PackageFields initialSlug={lead.packageCode} fieldErrors={fieldErrors} />
            <TextField label="Conversion remarks" name="remarks" multiline required maxLength={LEAD_EVENT_LIMIT} error={fieldErrors.remarks} />
            <div className="mt-1 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                {pending ? "Saving" : "Mark as converted"}
              </Button>
            </div>
          </>
        )}
      </Form>
    </Modal>
  );
}
