"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileField } from "@/components/ui/file-field";
import { Form, FormSuccess } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { COUNTRIES } from "@/content/countries";
import { formatPackagePrice } from "@/content/currencies";
import { packages, terms } from "@/content/packages";
import { timezoneForCountry } from "@/content/timezones";
import { INDUSTRIES, STAFF_COUNTS } from "@/features/leads/contract";
import { saveOnboarding } from "../actions";
import { CLIENT_BUSINESS_LIMITS, openClientSections, type ClientReviewSection, type OnboardingField, type PublicOnboarding } from "../contract";
import { PAYMENT_PROOF_ACCEPT } from "../payment-proof";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const LEFT = ["basic", "address", "consent"] as const satisfies readonly ClientReviewSection[];
const RIGHT = ["contacts", "package", "payment"] as const satisfies readonly ClientReviewSection[];

/** Company details, consent and payment, in the same section cards as a VA profile. A return shows only the sections that still need a change. */
export function OnboardingForm({ token, packet }: { token: string; packet: PublicOnboarding }) {
  const [country, setCountry] = useState(packet.business.country);
  const open = openClientSections(packet);
  const show = (section: ClientReviewSection) => open.includes(section);
  const returned = packet.reviewIssues.length > 0;
  const left = LEFT.filter(show);
  const right = RIGHT.filter(show);
  const columns = left.length > 0 && right.length > 0;

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="m-0 type-h2">Company registration</h1>
        <p className="m-0 max-w-[60ch] text-ink-muted">
          {returned
            ? "Update the sections below, then send it for review again."
            : "Fill in every section, then send it for review. You can return to this link any time."}
        </p>
      </div>
      {returned && packet.reviewNote && (
        <Alert tone="warning" title="A few details need a change">
          {packet.reviewNote}
        </Alert>
      )}
      <Form<OnboardingField>
        aria-label="Company registration"
        success={
          <FormSuccess title="Registration received">
            You can return to this link any time to see it.
          </FormSuccess>
        }
        onSubmit={saveOnboarding}
      >
        {({ pending, fieldErrors }) => (
          <div className="relative grid gap-4">
            <input type="hidden" name="token" value={token} />
            <KeptFields packet={packet} open={open} />
            <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
              <label htmlFor="fax">Fax</label>
              <input id="fax" name="fax" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <div className={columns ? "grid items-start gap-4 lg:grid-cols-2" : "grid gap-4"}>
              {left.length > 0 && (
                <div className="grid gap-4">
                  {show("basic") && <BasicFields packet={packet} fieldErrors={fieldErrors} />}
                  {show("address") && <AddressFields packet={packet} country={country} onCountry={setCountry} fieldErrors={fieldErrors} />}
                  {show("consent") && <ConsentFields fieldErrors={fieldErrors} />}
                </div>
              )}
              {right.length > 0 && (
                <div className="grid content-start gap-4">
                  {show("contacts") && <ContactFields packet={packet} fieldErrors={fieldErrors} />}
                  {show("package") && <PackageCard packet={packet} country={country} />}
                  {show("payment") && <PaymentFields packet={packet} />}
                </div>
              )}
            </div>
            <div>
              <Button type="submit" loading={pending}>
                {pending ? "Sending" : "Send for review"}
              </Button>
            </div>
          </div>
        )}
      </Form>
    </div>
  );
}

function BasicFields({ packet, fieldErrors }: Fields) {
  const business = packet.business;
  return (
    <Section title="Basic info">
      <TextField compact label="Company" name="companyName" required placeholder="Enter company name" defaultValue={packet.companyName} maxLength={160} error={fieldErrors.companyName} />
      <Select compact label="Industry" name="industry" required placeholder="Choose an industry" options={INDUSTRIES.map((name) => ({ value: name, label: name }))} defaultValue={business.industry} error={fieldErrors.industry} />
      <TextField compact label="Website" name="website" optional placeholder="Enter website" defaultValue={business.website} maxLength={CLIENT_BUSINESS_LIMITS.website} error={fieldErrors.website} />
      <Select compact label="Team size" name="staffCount" optional placeholder="Choose a team size" options={STAFF_COUNTS.map((name) => ({ value: name, label: name }))} defaultValue={business.staffCount} error={fieldErrors.staffCount} />
      <Wide>
        <TextField compact label="About the business" name="about" multiline required placeholder="What the team should know" defaultValue={business.about} maxLength={CLIENT_BUSINESS_LIMITS.about} error={fieldErrors.about} />
      </Wide>
    </Section>
  );
}

function AddressFields({ packet, country, onCountry, fieldErrors }: Fields & { country: string; onCountry: (country: string) => void }) {
  const business = packet.business;
  return (
    <Section title="Address">
      <div className="grid gap-3 sm:col-span-2">
        <TextField compact label="Street" name="street" optional placeholder="Enter street address" defaultValue={business.street} maxLength={CLIENT_BUSINESS_LIMITS.street} error={fieldErrors.street} />
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField compact label="City" name="city" required placeholder="Enter city" defaultValue={business.city} maxLength={CLIENT_BUSINESS_LIMITS.city} error={fieldErrors.city} />
          <TextField compact label="State" name="state" optional placeholder="Enter state" defaultValue={business.state} maxLength={CLIENT_BUSINESS_LIMITS.state} error={fieldErrors.state} />
          <TextField compact label="Zip code" name="zip" optional placeholder="Enter zip code" defaultValue={business.zip} maxLength={CLIENT_BUSINESS_LIMITS.zip} error={fieldErrors.zip} />
        </div>
        <Select compact label="Country" name="country" required placeholder="Choose a country" options={COUNTRIES.map((name) => ({ value: name, label: name }))} value={country} onChange={(event) => onCountry(event.target.value)} error={fieldErrors.country} />
      </div>
    </Section>
  );
}

function ContactFields({ packet, fieldErrors }: Fields) {
  const business = packet.business;
  return (
    <Section title="Contacts">
      <TextField compact label="Contact" name="contactName" required placeholder="Enter contact name" defaultValue={packet.contactName} maxLength={120} error={fieldErrors.contactName} />
      <TextField compact label="Job title" name="jobTitle" optional placeholder="Enter job title" defaultValue={business.jobTitle} maxLength={CLIENT_BUSINESS_LIMITS.jobTitle} error={fieldErrors.jobTitle} />
      <ReadOnly label="Email" value={packet.contactEmail} />
      <TextField compact label="Phone" name="contactPhone" type="tel" optional placeholder="Enter phone number" defaultValue={packet.contactPhone ?? ""} maxLength={40} error={fieldErrors.contactPhone} />
    </Section>
  );
}

function ConsentFields({ fieldErrors }: { fieldErrors: Partial<Record<OnboardingField, string>> }) {
  return (
    <Section title="Consent">
      <Wide>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="warning" size="sm" icon={null}>Sample</Badge>
        </div>
        <p className="m-0 mt-2 type-body-sm text-ink-muted">This wording is a sample and is not the final consent. Signing records your name as this company&apos;s confirmation of the package and of the details on this form.</p>
      </Wide>
      <Wide>
        <TextField compact label="Type your full name to sign" name="signature" required placeholder="Enter your full name" maxLength={120} error={fieldErrors.signature} />
      </Wide>
      <Wide>
        <Checkbox label="I agree to the consent above." name="consent" value="yes" required />
        {fieldErrors.consent && <p className="m-0 type-body-sm text-status-danger">{fieldErrors.consent}</p>}
      </Wide>
    </Section>
  );
}

function PaymentFields({ packet }: { packet: PublicOnboarding }) {
  return (
    <Section title="Payment">
      <Wide>
        {packet.paymentProofName ? <ReadOnly label="Current receipt" value={packet.paymentProofName} /> : null}
        <FileField
          compact
          label={packet.paymentProofName ? "Replace the receipt" : "Receipt"}
          name="proof"
          required
          accept={PAYMENT_PROOF_ACCEPT}
          hint="PDF, JPG, PNG or WebP, up to 2 MB."
        />
      </Wide>
    </Section>
  );
}

function PackageCard({ packet, country }: { packet: PublicOnboarding; country: string }) {
  const pkg = packages.find((item) => item.slug === packet.packageCode);
  const term = terms.find((item) => item.months === packet.termMonths);
  const zone = timezoneForCountry(country)?.label ?? "";
  const start = packet.startsOn ? day.format(new Date(`${packet.startsOn.slice(0, 10)}T00:00:00Z`)) : "";
  return (
    <Section title="Package">
      <ReadOnly label="Package" value={pkg?.name ?? ""} />
      <ReadOnly label="Hours" value={pkg?.hoursPerWeek ?? ""} />
      <ReadOnly label="Term" value={term?.label ?? ""} />
      <ReadOnly label="Monthly price" value={packet.monthlyCents ? formatPackagePrice(packet.monthlyCents, country) : ""} />
      <ReadOnly label="Start date" value={start} />
      <ReadOnly label="Time zone" value={zone ?? ""} />
    </Section>
  );
}

/** Closed sections stay on the packet. The server puts the stored values back, so a changed hidden field does not stick. */
function KeptFields({ packet, open }: { packet: PublicOnboarding; open: readonly ClientReviewSection[] }) {
  const business = packet.business;
  const closed = (section: ClientReviewSection) => !open.includes(section);
  return (
    <>
      {closed("basic") && (
        <>
          <input type="hidden" name="companyName" value={packet.companyName} />
          <input type="hidden" name="industry" value={business.industry} />
          <input type="hidden" name="website" value={business.website} />
          <input type="hidden" name="staffCount" value={business.staffCount} />
          <input type="hidden" name="about" value={business.about} />
        </>
      )}
      {closed("address") && (
        <>
          <input type="hidden" name="street" value={business.street} />
          <input type="hidden" name="city" value={business.city} />
          <input type="hidden" name="state" value={business.state} />
          <input type="hidden" name="zip" value={business.zip} />
          <input type="hidden" name="country" value={business.country} />
        </>
      )}
      {closed("contacts") && (
        <>
          <input type="hidden" name="contactName" value={packet.contactName} />
          <input type="hidden" name="jobTitle" value={business.jobTitle} />
          <input type="hidden" name="contactPhone" value={packet.contactPhone ?? ""} />
        </>
      )}
      {closed("consent") && (
        <>
          <input type="hidden" name="signature" value={packet.consentName ?? ""} />
          <input type="hidden" name="consent" value="yes" />
        </>
      )}
    </>
  );
}

type Fields = { packet: PublicOnboarding; fieldErrors: Partial<Record<OnboardingField, string>> };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section" padding="none">
      <h2 className="m-0 border-b border-border px-4 py-3 type-label">{title}</h2>
      <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function Wide({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-3 sm:col-span-2">{children}</div>;
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
