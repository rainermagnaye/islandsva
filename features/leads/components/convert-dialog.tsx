"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { Form } from "@/components/ui/form";
import { IconBadge } from "@/components/ui/icon-badge";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { PackageFields } from "@/features/clients/components/package-fields";
import { adminClientHref } from "@/content/routes";
import { CopyLink } from "@/features/clients/components/onboarding-link";
import { convertLeadNoted } from "../actions";
import { CONVERT_LIMITS, LEAD_EVENT_LIMIT, type LeadDetail } from "../contract";

/** Confirm the client and the package, then convert. The price is the catalogue price for that term. */
export function ConvertDialog({ lead, onClose }: { lead: LeadDetail; onClose: () => void }) {
  const [problem, setProblem] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string | null; clientId: string } | null>(null);

  if (problem) {
    return <ErrorDialog title="Couldn't convert" message={problem} onClose={() => { setProblem(null); onClose(); }} />;
  }

  if (link) {
    return (
      <Modal
        open
        onClose={onClose}
        align="center"
        icon={<IconBadge name="check" tone="success" size="xl" />}
        title="Registration link"
        description={link.url ? "They don't sign in. This link opens their company details, consent and payment, and they can return to it any time." : "The client was created. Generate the registration link from their profile."}
        footer={
          <>
            <Button href={adminClientHref(link.clientId)} variant="ghost">
              Open client
            </Button>
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </>
        }
      >
        {link.url && (
          <div className="mt-5 text-left">
            <CopyLink url={link.url} />
          </div>
        )}
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Convert to client" description="Confirm who they are and the package they'll start on. This adds a pending client and starts registration.">
      <Form aria-label="Convert to client" onSubmit={async (formData) => {
        const result = await convertLeadNoted(formData);
        if (result.ok) {
          setLink({ url: result.onboardingUrl, clientId: result.clientId });
          return { ok: true };
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
