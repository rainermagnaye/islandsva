"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { COUNTRIES } from "@/content/countries";
import { packages } from "@/content/packages";
import { adminLeadHref } from "@/content/routes";
import { saveLeadDetails } from "../actions";
import {
  BUDGET_RANGES,
  CONTACT_METHODS,
  CONTACT_TIMES,
  HIRING_TIMELINES,
  INDUSTRIES,
  LEAD_LIMITS,
  LEAD_PROFILE_LIMITS,
  LEAD_SOURCES,
  LEAD_STATUS_LABELS,
  MARKETING_CONSENT,
  PRIORITIES,
  STAFF_COUNTS,
  YEARS_IN_SERVICE,
  type LeadDetail,
  type LeadEditField,
} from "../contract";

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const stamp = (iso: string) => `${when.format(new Date(iso))} UTC`;

/** Same cards as the read-only profile. Each value is an input; dates, status and the closer stay read-only. */
export function LeadProfileForm({ lead }: { lead: LeadDetail }) {
  const router = useRouter();
  const profile = lead.profile;
  const close = () => router.push(adminLeadHref(lead.id));

  return (
    <Form<LeadEditField> aria-label="Edit lead profile" onSubmit={async (formData) => {
      const result = await saveLeadDetails(formData);
      if (result.ok) close();
      return result;
    }}>
      {({ pending, fieldErrors }) => (
        <div className="grid gap-4">
          <input type="hidden" name="leadId" value={lead.id} />
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Section title="Lead information">
              <TextField compact label="Full name" name="name" required placeholder="Enter full name" maxLength={LEAD_LIMITS.name} defaultValue={lead.fullName} error={fieldErrors.name} />
              <TextField compact label="Company" name="company" required placeholder="Enter company" maxLength={LEAD_LIMITS.company} defaultValue={lead.companyName ?? ""} error={fieldErrors.company} />
              <TextField compact label="Job title" name="jobTitle" optional placeholder="Enter job title" maxLength={LEAD_PROFILE_LIMITS.jobTitle} defaultValue={profile.jobTitle} error={fieldErrors.jobTitle} />
              <TextField compact label="Email" name="email" type="email" required placeholder="Enter email address" maxLength={LEAD_LIMITS.email} defaultValue={lead.email} error={fieldErrors.email} />
              <TextField compact label="Phone" name="phone" type="tel" optional placeholder="Enter phone number" maxLength={LEAD_PROFILE_LIMITS.phone} defaultValue={profile.phone} error={fieldErrors.phone} />
              <Select compact label="Industry" name="industry" required placeholder="Choose an industry" defaultValue={lead.industry ?? ""} options={[...INDUSTRIES]} error={fieldErrors.industry} />
              <Select compact label="Lead source" name="source" optional placeholder="Choose a lead source" defaultValue={profile.source} options={withCurrent(LEAD_SOURCES, profile.source)} error={fieldErrors.source} />
              <ReadOnly label="Date created" value={stamp(lead.createdAt)} />
              <ReadOnly label="Assigned closer" value={lead.closerName ?? "—"} />
              <ReadOnly label="Last updated" value={stamp(lead.updatedAt)} />
              <Wide>
                <TextField compact label="Discovery notes" name="message" multiline required placeholder="Enter discovery notes" maxLength={LEAD_LIMITS.message} defaultValue={lead.message} error={fieldErrors.message} />
              </Wide>
            </Section>
            <div className="grid content-start gap-4">
              <Section title="Contact preferences">
                <Select compact label="Preferred contact method" name="contactMethod" optional placeholder="Choose a contact method" defaultValue={profile.contactMethod} options={withCurrent(CONTACT_METHODS, profile.contactMethod)} error={fieldErrors.contactMethod} />
                <Select compact label="Best time to reach" name="bestTime" optional placeholder="Choose a time" defaultValue={profile.bestTime} options={withCurrent(CONTACT_TIMES, profile.bestTime)} error={fieldErrors.bestTime} />
                <Select compact label="Marketing consent" name="consent" optional placeholder="Choose consent" defaultValue={profile.consent} options={withCurrent(MARKETING_CONSENT, profile.consent)} error={fieldErrors.consent} />
              </Section>
              <Section title="Business">
                <Select compact label="Years in service" name="yearsInService" optional placeholder="Choose years in service" defaultValue={profile.yearsInService} options={withCurrent(YEARS_IN_SERVICE, profile.yearsInService)} error={fieldErrors.yearsInService} />
                <Select compact label="Number of employees" name="staffCount" optional placeholder="Choose number of employees" defaultValue={profile.staffCount} options={withCurrent(STAFF_COUNTS, profile.staffCount)} error={fieldErrors.staffCount} />
                <ReadOnly label="Lead status" value={LEAD_STATUS_LABELS[lead.status]} />
                <TextField compact label="Dropped reason" name="droppedReason" optional placeholder="Enter dropped reason" maxLength={LEAD_PROFILE_LIMITS.droppedReason} defaultValue={profile.droppedReason} error={fieldErrors.droppedReason} />
              </Section>
            </div>
          </div>
          <Section title="Address">
            <Wide>
              <TextField compact label="Street" name="street" optional placeholder="Enter street" maxLength={LEAD_PROFILE_LIMITS.street} defaultValue={profile.street} error={fieldErrors.street} />
            </Wide>
            <TextField compact label="City" name="city" optional placeholder="Enter city" maxLength={LEAD_PROFILE_LIMITS.city} defaultValue={profile.city} error={fieldErrors.city} />
            <TextField compact label="State" name="state" optional placeholder="Enter state or province" maxLength={LEAD_PROFILE_LIMITS.state} defaultValue={profile.state} error={fieldErrors.state} />
            <TextField compact label="Zip code" name="zip" optional placeholder="Enter zip code" maxLength={LEAD_PROFILE_LIMITS.zip} defaultValue={profile.zip} error={fieldErrors.zip} />
            <Select compact label="Country" name="country" required placeholder="Choose a country" defaultValue={lead.country ?? ""} options={[...COUNTRIES]} error={fieldErrors.country} />
          </Section>
          <Section title="Qualification">
            <Select compact label="Service of interest" name="package" optional options={[{ value: "", label: "Not sure yet" }, ...packages.map((item) => ({ value: item.slug, label: item.name }))]} defaultValue={lead.packageCode ?? ""} error={fieldErrors.package} />
            <Select compact label="Budget range" name="budget" optional placeholder="Choose a budget range" defaultValue={profile.budget} options={withCurrent(BUDGET_RANGES, profile.budget)} error={fieldErrors.budget} />
            <Select compact label="Timeline for hiring" name="hiringTimeline" optional placeholder="Choose a timeline" defaultValue={profile.hiringTimeline} options={withCurrent(HIRING_TIMELINES, profile.hiringTimeline)} error={fieldErrors.hiringTimeline} />
            <TextField compact label="Decision maker" name="decisionMaker" optional placeholder="Enter decision maker" maxLength={LEAD_PROFILE_LIMITS.decisionMaker} defaultValue={profile.decisionMaker} error={fieldErrors.decisionMaker} />
            <Select compact label="Priority" name="priority" optional placeholder="Choose a priority" defaultValue={profile.priority} options={withCurrent(PRIORITIES, profile.priority)} error={fieldErrors.priority} />
          </Section>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={pending}>
              {pending ? "Saving" : "Save profile"}
            </Button>
            <Button type="button" variant="ghost" onClick={close} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Form>
  );
}

function withCurrent(options: readonly string[], current: string) {
  return current && !options.includes(current) ? [current, ...options] : [...options];
}

function Wide({ children }: { children: ReactNode }) {
  return <div className="min-w-0 sm:col-span-2">{children}</div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section" padding="none">
      <h2 className="m-0 border-b border-border px-4 py-3 type-label">{title}</h2>
      <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="m-0 type-caption text-ink-muted">{label}</p>
      <p className="m-0 type-body-sm text-ink">{value}</p>
    </div>
  );
}
