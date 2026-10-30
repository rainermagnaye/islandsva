"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { COUNTRIES } from "@/content/countries";
import { INDUSTRIES, STAFF_COUNTS } from "@/features/leads/contract";
import { saveRegistrationDetailsAction } from "../registration-actions";
import { CLIENT_BUSINESS_LIMITS, type ClientBusiness, type ClientDetailField } from "../contract";
import { ReadOnly, Section, Wide } from "./registration-section";

const options = (names: readonly string[]) => names.map((name) => ({ value: name, label: name }));

type DetailsStepProps = {
  token: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  business: ClientBusiness;
  /** The last open step: saving sends the registration for review. */
  last: boolean;
};

/** Step 1: company, address and contact details, in one form. */
export function DetailsStep({ token, companyName, contactName, contactEmail, contactPhone, business, last }: DetailsStepProps) {
  return (
    <Form<ClientDetailField> aria-label="Company details" onSubmit={saveRegistrationDetailsAction}>
      {({ pending, fieldErrors }) => (
        <div className="grid gap-4">
          <input type="hidden" name="token" value={token} />
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Section title="Company">
              <TextField compact label="Company" name="companyName" required placeholder="Enter company name" defaultValue={companyName} maxLength={160} error={fieldErrors.companyName} />
              <Select compact label="Industry" name="industry" required placeholder="Choose an industry" options={options(INDUSTRIES)} defaultValue={business.industry} error={fieldErrors.industry} />
              <TextField compact label="Website" name="website" optional placeholder="Enter website" defaultValue={business.website} maxLength={CLIENT_BUSINESS_LIMITS.website} error={fieldErrors.website} />
              <Select compact label="Team size" name="staffCount" optional placeholder="Choose a team size" options={options(STAFF_COUNTS)} defaultValue={business.staffCount} error={fieldErrors.staffCount} />
              <Wide>
                <TextField compact label="About the business" name="about" multiline required placeholder="What the team should know" defaultValue={business.about} maxLength={CLIENT_BUSINESS_LIMITS.about} error={fieldErrors.about} />
              </Wide>
            </Section>
            <div className="grid content-start gap-4">
              <Section title="Address">
                <Wide>
                  <TextField compact label="Street" name="street" optional placeholder="Enter street address" defaultValue={business.street} maxLength={CLIENT_BUSINESS_LIMITS.street} error={fieldErrors.street} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <TextField compact label="City" name="city" required placeholder="Enter city" defaultValue={business.city} maxLength={CLIENT_BUSINESS_LIMITS.city} error={fieldErrors.city} />
                    <TextField compact label="State" name="state" optional placeholder="Enter state" defaultValue={business.state} maxLength={CLIENT_BUSINESS_LIMITS.state} error={fieldErrors.state} />
                    <TextField compact label="Zip code" name="zip" optional placeholder="Enter zip code" defaultValue={business.zip} maxLength={CLIENT_BUSINESS_LIMITS.zip} error={fieldErrors.zip} />
                  </div>
                  <Select compact label="Country" name="country" required placeholder="Choose a country" options={options(COUNTRIES)} defaultValue={business.country} error={fieldErrors.country} />
                </Wide>
              </Section>
              <Section title="Contact">
                <TextField compact label="Contact" name="contactName" required placeholder="Enter contact name" defaultValue={contactName} maxLength={120} error={fieldErrors.contactName} />
                <TextField compact label="Job title" name="jobTitle" optional placeholder="Enter job title" defaultValue={business.jobTitle} maxLength={CLIENT_BUSINESS_LIMITS.jobTitle} error={fieldErrors.jobTitle} />
                <ReadOnly label="Email" value={contactEmail} />
                <TextField compact label="Phone" name="contactPhone" type="tel" optional placeholder="Enter phone number" defaultValue={contactPhone ?? ""} maxLength={40} error={fieldErrors.contactPhone} />
              </Section>
            </div>
          </div>
          <div>
            <Button type="submit" loading={pending}>
              {pending ? "Saving" : last ? "Save and send for review" : "Save and continue"}
            </Button>
          </div>
        </div>
      )}
    </Form>
  );
}
