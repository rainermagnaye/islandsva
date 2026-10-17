"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { COUNTRIES } from "@/content/countries";
import { packages } from "@/content/packages";
import { addLead } from "../actions";
import { INDUSTRIES, LEAD_LIMITS, type LeadField } from "../contract";

/** The discovery-call fields, filled in by an admin. The lead is stored as New. */
export function CreateLeadForm({ onAdded }: { onAdded: () => void }) {
  return (
    <Form<LeadField>
      aria-label="Create a lead"
      onSubmit={async (formData) => {
        const result = await addLead(formData);
        if (result.ok) onAdded();
        return result;
      }}
    >
      {({ pending, fieldErrors }) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Full name" name="name" autoComplete="off" required maxLength={LEAD_LIMITS.name} error={fieldErrors.name} data-autofocus />
            <TextField label="Email address" name="email" type="email" autoComplete="off" required maxLength={LEAD_LIMITS.email} error={fieldErrors.email} />
          </div>
          <TextField label="Company" name="company" autoComplete="off" required maxLength={LEAD_LIMITS.company} error={fieldErrors.company} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Select label="Industry" name="industry" required placeholder="Choose an industry" options={[...INDUSTRIES]} error={fieldErrors.industry} />
            <Select label="Country" name="country" required placeholder="Choose a country" options={[...COUNTRIES]} error={fieldErrors.country} />
          </div>
          <Select
            label="Package"
            name="package"
            optional
            options={[{ value: "", label: "Not sure yet" }, ...packages.map((item) => ({ value: item.slug, label: `${item.name} — ${item.hoursPerWeek}` }))]}
            error={fieldErrors.package}
          />
          <TextField label="How can we help?" name="message" multiline rows={4} required maxLength={LEAD_LIMITS.message} error={fieldErrors.message} />
          <div>
            <Button type="submit" loading={pending} iconLeft="plus">
              {pending ? "Adding" : "Create Lead"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
