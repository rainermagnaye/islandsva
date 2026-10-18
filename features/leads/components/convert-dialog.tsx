"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { formatPrice, packages, terms } from "@/content/packages";
import { convertLeadNoted } from "../actions";
import { CONVERT_LIMITS, LEAD_EVENT_LIMIT, PACKAGE_TIMEZONES, type LeadDetail } from "../contract";

const HOUR_OPTIONS = packages.map((item) => ({ value: String(item.weeklyHours), label: item.hoursPerWeek }));
const TERM_OPTIONS = terms.map((term) => ({
  value: String(term.months),
  label: term.months === 1 ? term.label : `${term.label} — ${term.note}`,
}));

function isoDay(offset: number) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Confirm the client and the package, then convert. The price is the catalogue price for that term. */
export function ConvertDialog({ lead, onClose }: { lead: LeadDetail; onClose: () => void }) {
  const initial = packages.find((item) => item.slug === lead.packageCode);
  const [packageSlug, setPackageSlug] = useState(initial?.slug ?? "");
  const [hours, setHours] = useState(initial ? String(initial.weeklyHours) : "");
  const [termMonths, setTermMonths] = useState("1");
  const [problem, setProblem] = useState<string | null>(null);
  const chosen = packages.find((item) => item.slug === packageSlug);
  const term = terms.find((item) => String(item.months) === termMonths);
  const price = chosen && term ? formatPrice(chosen.monthlyPrice[term.months]) : null;

  function choosePackage(slug: string) {
    setPackageSlug(slug);
    const next = packages.find((item) => item.slug === slug);
    if (next) setHours(String(next.weeklyHours));
  }

  function chooseHours(value: string) {
    setHours(value);
    const next = packages.find((item) => String(item.weeklyHours) === value);
    if (next) setPackageSlug(next.slug);
  }

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
            <Select
              label="Package"
              name="package"
              required
              placeholder="Choose a package"
              options={packages.map((item) => ({ value: item.slug, label: item.name }))}
              value={packageSlug}
              onChange={(event) => choosePackage(event.target.value)}
              error={fieldErrors.package}
            />
            <Select
              label="Hours"
              name="hoursPerWeek"
              required
              placeholder="Choose the hours"
              options={HOUR_OPTIONS}
              value={hours}
              onChange={(event) => chooseHours(event.target.value)}
              error={fieldErrors.hoursPerWeek}
            />
            <Select
              label="Term"
              name="termMonths"
              required
              options={TERM_OPTIONS}
              value={termMonths}
              onChange={(event) => setTermMonths(event.target.value)}
              error={fieldErrors.termMonths}
            />
            <p className="m-0 rounded-md bg-surface-sunken px-3.5 py-3 type-body-sm text-ink">
              {chosen && term && price ? `${chosen.name}, ${chosen.hoursPerWeek}, ${term.label.toLowerCase()} at ${price} a month.` : "Choose a package to confirm the monthly price."}
            </p>
            <TextField label="Start date" name="startsOn" type="date" required min={isoDay(0)} max={isoDay(366)} hint="The first day their coverage begins." error={fieldErrors.startsOn} />
            <Select
              label="Time zone"
              name="timezone"
              required
              placeholder="Choose their time zone"
              options={PACKAGE_TIMEZONES.map((zone) => ({ value: zone.value, label: zone.label }))}
              error={fieldErrors.timezone}
            />
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
