"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { COUNTRIES } from "@/content/countries";
import { formatPackagePrice } from "@/content/currencies";
import { packages, terms } from "@/content/packages";
import { timezoneForCountry } from "@/content/timezones";
import { INDUSTRIES, STAFF_COUNTS } from "@/features/leads/contract";
import { saveClientDetails } from "../actions";
import { CLIENT_BUSINESS_LIMITS, type ClientDetail, type ClientDetailField } from "../contract";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** The same sections as the profile. The email stays as it is. The package price follows the country. */
export function ClientCompanyForm({ client, onClose }: { client: ClientDetail; onClose: () => void }) {
  const business = client.business;
  const [country, setCountry] = useState(business.country);
  const [problem, setProblem] = useState<string | null>(null);
  if (problem) return <ErrorDialog title="Couldn't save" message={problem} onClose={() => setProblem(null)} />;
  return (
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
        <div className="grid gap-4">
          <input type="hidden" name="clientId" value={client.id} />
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="grid gap-4">
              <Section title="Basic info">
                <TextField compact label="Company" name="companyName" required defaultValue={client.companyName} maxLength={160} error={fieldErrors.companyName} />
                <Select compact label="Industry" name="industry" optional placeholder="Choose an industry" options={INDUSTRIES.map((name) => ({ value: name, label: name }))} defaultValue={business.industry} error={fieldErrors.industry} />
                <TextField compact label="Website" name="website" optional defaultValue={business.website} maxLength={CLIENT_BUSINESS_LIMITS.website} error={fieldErrors.website} />
                <Select compact label="Team size" name="staffCount" optional placeholder="Choose a team size" options={STAFF_COUNTS.map((name) => ({ value: name, label: name }))} defaultValue={business.staffCount} error={fieldErrors.staffCount} />
                <Wide>
                  <TextField compact label="About the business" name="about" multiline optional defaultValue={business.about} maxLength={CLIENT_BUSINESS_LIMITS.about} error={fieldErrors.about} />
                </Wide>
              </Section>
              <Section title="Address">
                <Wide>
                  <TextField compact label="Street" name="street" optional defaultValue={business.street} maxLength={CLIENT_BUSINESS_LIMITS.street} error={fieldErrors.street} />
                </Wide>
                <TextField compact label="City" name="city" optional defaultValue={business.city} maxLength={CLIENT_BUSINESS_LIMITS.city} error={fieldErrors.city} />
                <TextField compact label="State" name="state" optional defaultValue={business.state} maxLength={CLIENT_BUSINESS_LIMITS.state} error={fieldErrors.state} />
                <TextField compact label="Zip code" name="zip" optional defaultValue={business.zip} maxLength={CLIENT_BUSINESS_LIMITS.zip} error={fieldErrors.zip} />
                <Select compact label="Country" name="country" optional placeholder="Choose a country" options={COUNTRIES.map((name) => ({ value: name, label: name }))} value={country} onChange={(event) => setCountry(event.target.value)} error={fieldErrors.country} />
              </Section>
            </div>
            <div className="grid content-start gap-4">
              <Section title="Contacts">
                <TextField compact label="Contact" name="contactName" required defaultValue={client.contactName} maxLength={120} error={fieldErrors.contactName} />
                <TextField compact label="Job title" name="jobTitle" optional defaultValue={business.jobTitle} maxLength={CLIENT_BUSINESS_LIMITS.jobTitle} error={fieldErrors.jobTitle} />
                <ReadOnly label="Email" value={client.contactEmail} />
                <TextField compact label="Phone" name="contactPhone" type="tel" optional defaultValue={client.contactPhone ?? ""} maxLength={40} error={fieldErrors.contactPhone} />
              </Section>
              <PackageCard client={client} country={country} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={pending}>
              {pending ? "Saving" : "Save details"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Form>
  );
}

function PackageCard({ client, country }: { client: ClientDetail; country: string }) {
  const pkg = packages.find((item) => item.slug === client.packageCode);
  const term = terms.find((item) => item.months === client.termMonths);
  const zone = timezoneForCountry(country)?.label ?? "";
  const start = client.startsOn ? day.format(new Date(`${client.startsOn.slice(0, 10)}T00:00:00Z`)) : "";
  return (
    <Section title="Package">
      <ReadOnly label="Package" value={pkg?.name ?? ""} />
      <ReadOnly label="Hours" value={pkg?.hoursPerWeek ?? ""} />
      <ReadOnly label="Term" value={term?.label ?? ""} />
      <ReadOnly label="Monthly price" value={client.monthlyCents ? formatPackagePrice(client.monthlyCents, country) : ""} />
      <ReadOnly label="Start date" value={start} />
      <ReadOnly label="Time zone" value={zone ?? ""} />
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section" padding="none">
      <h2 className="m-0 border-b border-border px-4 py-3 type-label">{title}</h2>
      <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function Wide({ children }: { children: ReactNode }) {
  return <div className="min-w-0 sm:col-span-2">{children}</div>;
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  const shown = value.trim() || "Not provided";
  return (
    <div className="min-w-0">
      <p className="m-0 type-caption text-ink-muted">{label}</p>
      <p className={`m-0 type-body-sm ${shown === "Not provided" ? "text-ink-muted" : "text-ink"}`}>{shown}</p>
    </div>
  );
}
