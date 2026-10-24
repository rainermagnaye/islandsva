"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormSuccess } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { COUNTRIES } from "@/content/countries";
import { routes } from "@/content/routes";
import { INDUSTRIES, STAFF_COUNTS } from "@/features/leads/contract";
import { submitOnboardingForm } from "../api-client";
import { CLIENT_BILLING_LIMITS, CLIENT_BUSINESS_LIMITS, NEW_CLIENT_LIMITS, type OnboardingField, type OnboardingInvitation, type OnboardingPayload } from "../contract";

const COUNTRY_OPTIONS = COUNTRIES.map((name) => ({ value: name, label: name }));
const TEXT_FIELDS = [
  "contactName", "contactPhone", "jobTitle", "industry", "website", "staffCount", "about", "street", "city", "state", "zip", "country",
  "billingName", "billingEmail", "billingStreet", "billingCity", "billingState", "billingZip", "billingCountry", "billingTaxId",
] as const satisfies readonly Exclude<OnboardingField, "consent">[];

function payloadFrom(token: string, formData: FormData): OnboardingPayload {
  const fields = Object.fromEntries(TEXT_FIELDS.map((name) => [name, String(formData.get(name) ?? "")])) as Record<(typeof TEXT_FIELDS)[number], string>;
  return { token, consent: formData.get("consent") === "on", ...fields };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 grid gap-5 border-0 p-0 sm:grid-cols-2">
      <legend className="mb-4 type-label">{title}</legend>
      {children}
    </fieldset>
  );
}

const wide = "sm:col-span-2";

/** The client's contact, company and billing details, then consent. Starts from what we already know. */
export function OnboardingForm({ token, invitation, packageSummary }: { token: string; invitation: OnboardingInvitation; packageSummary: string | null }) {
  const b = invitation.business;
  return (
    <Card padding="md">
      <Form<OnboardingField>
        aria-label="Onboarding form"
        onSubmit={(formData) => submitOnboardingForm(payloadFrom(token, formData))}
        success={
          <FormSuccess title="Thank you, that's everything for now" align="center">
            We&apos;ve got your details. Your Islands VA contact will be in touch about payment and your start date.
          </FormSuccess>
        }
      >
        {({ pending, fieldErrors }) => (
          <>
            {packageSummary && (
              <p className="m-0 rounded-md bg-surface-sunken px-3.5 py-3 type-body-sm text-ink">
                <span className="type-label">Your package: </span>
                {packageSummary}
              </p>
            )}
            <Section title="You">
              <TextField label="Your name" name="contactName" required autoComplete="name" defaultValue={invitation.contactName} maxLength={NEW_CLIENT_LIMITS.contactName} error={fieldErrors.contactName} />
              <TextField label="Job title" name="jobTitle" optional autoComplete="organization-title" defaultValue={b.jobTitle} maxLength={CLIENT_BUSINESS_LIMITS.jobTitle} error={fieldErrors.jobTitle} />
              <TextField label="Email" name="contactEmailShown" type="email" readOnly disabled defaultValue={invitation.contactEmail} hint="Your login will use this address." />
              <TextField label="Phone" name="contactPhone" type="tel" optional autoComplete="tel" defaultValue={invitation.contactPhone ?? ""} maxLength={NEW_CLIENT_LIMITS.contactPhone} error={fieldErrors.contactPhone} />
            </Section>
            <Section title={invitation.companyName}>
              <Select label="Industry" name="industry" required placeholder="Choose your industry" options={INDUSTRIES.map((name) => ({ value: name, label: name }))} defaultValue={b.industry} error={fieldErrors.industry} />
              <Select label="Team size" name="staffCount" optional placeholder="Choose a team size" options={STAFF_COUNTS.map((name) => ({ value: name, label: name }))} defaultValue={b.staffCount} error={fieldErrors.staffCount} />
              <div className={wide}>
                <TextField label="Website" name="website" optional autoComplete="url" defaultValue={b.website} maxLength={CLIENT_BUSINESS_LIMITS.website} error={fieldErrors.website} />
              </div>
              <div className={wide}>
                <TextField label="What should your VA help with?" name="about" multiline required defaultValue={b.about} maxLength={CLIENT_BUSINESS_LIMITS.about} hint="The tasks you'd hand off first, your tools and your working hours." error={fieldErrors.about} />
              </div>
              <div className={wide}>
                <TextField label="Street" name="street" optional autoComplete="address-line1" defaultValue={b.street} maxLength={CLIENT_BUSINESS_LIMITS.street} error={fieldErrors.street} />
              </div>
              <TextField label="City" name="city" required autoComplete="address-level2" defaultValue={b.city} maxLength={CLIENT_BUSINESS_LIMITS.city} error={fieldErrors.city} />
              <TextField label="State" name="state" optional autoComplete="address-level1" defaultValue={b.state} maxLength={CLIENT_BUSINESS_LIMITS.state} error={fieldErrors.state} />
              <TextField label="Zip code" name="zip" optional autoComplete="postal-code" defaultValue={b.zip} maxLength={CLIENT_BUSINESS_LIMITS.zip} error={fieldErrors.zip} />
              <Select label="Country" name="country" required placeholder="Choose your country" options={COUNTRY_OPTIONS} defaultValue={b.country} error={fieldErrors.country} />
            </Section>
            <Section title="Billing">
              <TextField label="Bill to" name="billingName" required hint="A company or a person." defaultValue={invitation.companyName} maxLength={CLIENT_BILLING_LIMITS.name} error={fieldErrors.billingName} />
              <TextField label="Billing email" name="billingEmail" type="email" required defaultValue={invitation.contactEmail} maxLength={CLIENT_BILLING_LIMITS.email} error={fieldErrors.billingEmail} />
              <div className={wide}>
                <TextField label="Billing street" name="billingStreet" optional maxLength={CLIENT_BILLING_LIMITS.street} error={fieldErrors.billingStreet} />
              </div>
              <TextField label="Billing city" name="billingCity" optional maxLength={CLIENT_BILLING_LIMITS.city} error={fieldErrors.billingCity} />
              <TextField label="Billing state" name="billingState" optional maxLength={CLIENT_BILLING_LIMITS.state} error={fieldErrors.billingState} />
              <TextField label="Billing zip code" name="billingZip" optional maxLength={CLIENT_BILLING_LIMITS.zip} error={fieldErrors.billingZip} />
              <Select label="Billing country" name="billingCountry" optional placeholder="Choose a country" options={COUNTRY_OPTIONS} error={fieldErrors.billingCountry} />
              <TextField label="Tax ID" name="billingTaxId" optional hint="For example a VAT or EIN number, if your invoices need it." maxLength={CLIENT_BILLING_LIMITS.taxId} error={fieldErrors.billingTaxId} />
            </Section>
            <p className="m-0 type-body-sm text-ink-muted">
              {/* TODO(content): payment instructions once the team confirms how clients pay before M4 (Stripe). */}
              Payment: your Islands VA contact will send you payment details after you submit this form.
            </p>
            <p className="m-0 type-body-sm text-ink-muted">
              Please read our <Link href={routes.terms}>Terms of use</Link> and <Link href={routes.privacy}>Privacy Policy</Link> before you send your details.
            </p>
            <Checkbox name="consent" required label="I agree to the Terms of use and the Privacy Policy." aria-invalid={fieldErrors.consent ? true : undefined} />
            {fieldErrors.consent && <p className="m-0 type-label text-status-danger">{fieldErrors.consent}</p>}
            <div className="border-t border-border pt-4">
              <Button type="submit" loading={pending} block>
                {pending ? "Sending" : "Send my details"}
              </Button>
            </div>
          </>
        )}
      </Form>
    </Card>
  );
}
