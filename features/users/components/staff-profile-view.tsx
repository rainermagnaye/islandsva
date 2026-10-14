import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { GENDER_LABELS, MARITAL_LABELS, REGISTRATION_STATUS_LABELS, type RegistrationStep, type StaffDetails } from "../contract";
import { formatAddress, formatProfileDate, type StaffProfileMeta } from "../profile-fields";

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

function shown(value: string) {
  const text = value.trim();
  return text || "Not provided";
}

function shownDate(value: string) {
  if (!value) return "Not provided";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : when.format(date);
}

/** Read-only profile sections. Editing replaces each value with a field and keeps these cards. */
export function StaffProfileView({ details, email, meta }: { details: StaffDetails; email: string; meta: StaffProfileMeta }) {
  const emergency = [details.emergencyName, details.emergencyRelationship, details.emergencyPhone].map((part) => part.trim()).filter(Boolean);
  const jobs = details.employers.filter((job) => job.company.trim() || job.position.trim() || job.duration.trim());

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="grid gap-4">
        <DetailsCard title="Basic details">
          <Field label="Full name" value={shown(details.fullName)} />
          <Field label="Date of birth" value={shownDate(details.dateOfBirth)} />
          <Field label="Gender" value={details.gender ? GENDER_LABELS[details.gender] : "Not provided"} />
          <Field label="Nationality" value={shown(details.nationality)} />
          <Field label="Marital status" value={details.maritalStatus ? MARITAL_LABELS[details.maritalStatus] : "Not provided"} />
        </DetailsCard>
        <DetailsCard title="Address information">
          <Field label="Current address" value={shown(formatAddress(details.currentStreet, details.currentCity, details.currentProvince, details.currentPostalCode))} wide />
          <Field label="Permanent address" value={shown(formatAddress(details.permanentStreet, details.permanentCity, details.permanentProvince, details.permanentPostalCode))} wide />
        </DetailsCard>
        <DetailsCard title="Education and skills">
          <Field label="Highest education" value={shown(details.highestEducation)} />
          <Field label="Languages" value={shown(details.languages)} />
          <Field label="Skills" value={shown(details.skills)} />
          <Field label="Résumé" value={shown(details.resumeName)} />
          <Field label="Certifications" value={shown(details.certifications)} wide />
        </DetailsCard>
      </div>
      <div className="grid gap-4">
        <DetailsCard title="Contact information">
          <Field label="Email" value={email} />
          <Field label="Phone" value={shown(details.mobileNumber)} />
          <Field label="Alternate phone" value={shown(details.alternatePhone)} />
          <Field label="Emergency contact" value={emergency.length > 0 ? emergency.join(" · ") : "Not provided"} wide />
        </DetailsCard>
        <DetailsCard title="Work experience">
          {jobs.length === 0 ? (
            <Field label="Employers" value="Not provided" wide />
          ) : (
            jobs.map((job, index) => (
              <Field
                key={index}
                label={job.position.trim() || "Role"}
                value={[job.company, job.duration].map((part) => part.trim()).filter(Boolean).join(" · ") || "Not provided"}
                wide
              />
            ))
          )}
          <Field label="Key responsibilities" value={shown(details.keyResponsibilities)} wide />
          <Field label="Achievements" value={shown(details.achievements)} wide />
        </DetailsCard>
      </div>
      <div className="lg:col-span-2">
        <DetailsCard title="System metadata">
          <Field label="Registration status" value={REGISTRATION_STATUS_LABELS[meta.registrationStatus]} />
          <Field label="Progress tracker" value={meta.progress} />
          <Field label="Date of invitation sent" value={formatProfileDate(meta.invitationSentAt)} />
          <Field label="Date of registration completed" value={formatProfileDate(meta.registrationCompletedAt)} />
        </DetailsCard>
      </div>
    </div>
  );
}

export function RegistrationStepper({ steps }: { steps: readonly RegistrationStep[] }) {
  return (
    <Card as="section" padding="sm" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h2 className="m-0 type-label">Registration</h2>
      <ol className="m-0 flex list-none flex-wrap gap-y-2 p-0" aria-label="Registration progress">
        {steps.map((step, index) => (
          <li key={step.id} className="flex min-w-0 items-center">
            <span
              className={
                step.done
                  ? "grid size-7 place-items-center rounded-pill bg-status-success-bg text-status-success"
                  : step.current
                    ? "grid size-7 place-items-center rounded-pill bg-action-primary text-on-action-primary type-label"
                    : "grid size-7 place-items-center rounded-pill bg-surface-sunken text-ink-muted type-label"
              }
            >
              {step.done ? <Icon name="check" size={16} /> : index + 1}
              <span className="sr-only">{step.done ? "Complete" : step.current ? "Current step" : "Not started"}</span>
            </span>
            <span className={`px-2 type-label ${step.current ? "text-ink" : "text-ink-muted"}`} aria-current={step.current ? "step" : undefined}>
              {step.label}
            </span>
            {index < steps.length - 1 && <span className="mr-2 h-px w-4 bg-border" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** A read-only group of profile fields: a title bar over a two-column list. */
function DetailsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section" padding="none">
      <h2 className="m-0 border-b border-border px-4 py-3 type-label">{title}</h2>
      <dl className="m-0 grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">{children}</dl>
    </Card>
  );
}

function Field({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  const empty = value === "Not provided";
  return (
    <div className={wide ? "min-w-0 sm:col-span-2" : "min-w-0"}>
      <dt className="type-caption text-ink-muted">{label}</dt>
      <dd className={`m-0 whitespace-pre-line type-body-sm ${empty ? "text-ink-muted" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
