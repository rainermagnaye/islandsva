"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { COUNTRIES } from "@/content/countries";
import { INDUSTRIES, STAFF_COUNTS } from "@/features/leads/contract";
import { saveClientDetails } from "../actions";
import { CLIENT_BUSINESS_LIMITS, type ClientDetail, type ClientDetailField } from "../contract";

/** Company details, starting from what the lead already gave us. */
export function ClientCompanyForm({ client, onClose }: { client: ClientDetail; onClose: () => void }) {
  const business = client.business;
  const [problem, setProblem] = useState<string | null>(null);
  if (problem) return <ErrorDialog title="Couldn't save" message={problem} onClose={() => setProblem(null)} />;
  return (
    <Card as="section" padding="md">
      <h2 className="m-0 mb-5 type-label">Edit company details</h2>
      <Form<ClientDetailField>
        aria-label="Company details"
        onSubmit={async (formData) => {
          const result = await saveClientDetails(formData);
          if (result.ok) {
            onClose();
            return result;
          }
          if (result.fieldErrors) return result;
          setProblem(result.message);
          return { ok: true };
        }}
      >
        {({ pending, fieldErrors }) => (
          <>
            <input type="hidden" name="clientId" value={client.id} />
            <div className="grid gap-5 sm:grid-cols-2">
              <h3 className="m-0 type-label sm:col-span-2">Basic info</h3>
              <TextField label="Company" name="companyName" required defaultValue={client.companyName} maxLength={160} error={fieldErrors.companyName} />
              <Select label="Industry" name="industry" optional placeholder="Choose an industry" options={INDUSTRIES.map((name) => ({ value: name, label: name }))} defaultValue={business.industry} error={fieldErrors.industry} />
              <TextField label="Website" name="website" optional defaultValue={business.website} maxLength={CLIENT_BUSINESS_LIMITS.website} error={fieldErrors.website} />
              <Select label="Team size" name="staffCount" optional placeholder="Choose a team size" options={STAFF_COUNTS.map((name) => ({ value: name, label: name }))} defaultValue={business.staffCount} error={fieldErrors.staffCount} />
              <div className="sm:col-span-2">
                <TextField label="About the business" name="about" multiline optional defaultValue={business.about} maxLength={CLIENT_BUSINESS_LIMITS.about} hint="What the team should know before the VA starts." error={fieldErrors.about} />
              </div>
              <h3 className="m-0 type-label sm:col-span-2">Address</h3>
              <div className="sm:col-span-2">
                <TextField label="Street" name="street" optional defaultValue={business.street} maxLength={CLIENT_BUSINESS_LIMITS.street} error={fieldErrors.street} />
              </div>
              <TextField label="City" name="city" optional defaultValue={business.city} maxLength={CLIENT_BUSINESS_LIMITS.city} error={fieldErrors.city} />
              <TextField label="State" name="state" optional defaultValue={business.state} maxLength={CLIENT_BUSINESS_LIMITS.state} error={fieldErrors.state} />
              <TextField label="Zip code" name="zip" optional defaultValue={business.zip} maxLength={CLIENT_BUSINESS_LIMITS.zip} error={fieldErrors.zip} />
              <Select label="Country" name="country" optional placeholder="Choose a country" options={COUNTRIES.map((name) => ({ value: name, label: name }))} defaultValue={business.country} error={fieldErrors.country} />
              <h3 className="m-0 type-label sm:col-span-2">Contacts</h3>
              <TextField label="Contact" name="contactName" required defaultValue={client.contactName} maxLength={120} error={fieldErrors.contactName} />
              <TextField label="Job title" name="jobTitle" optional defaultValue={business.jobTitle} maxLength={CLIENT_BUSINESS_LIMITS.jobTitle} error={fieldErrors.jobTitle} />
              <TextField label="Phone" name="contactPhone" type="tel" optional defaultValue={client.contactPhone ?? ""} maxLength={40} error={fieldErrors.contactPhone} />
            </div>
            <div className="mt-1 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                {pending ? "Saving" : "Save details"}
              </Button>
            </div>
          </>
        )}
      </Form>
    </Card>
  );
}
