"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import {
  GENDERS,
  GENDER_LABELS,
  MARITAL_LABELS,
  MARITAL_STATUSES,
  STAFF_LIMITS,
  USER_LIMITS,
  type StaffDetails,
  type StaffEmployer,
} from "../contract";
import { saveStaffProfileForm } from "../actions";

/** The staff profile form: every section, plus a résumé that fills blank sections when it can. */
export function StaffProfileForm({
  userId,
  email,
  details,
  onSaved,
  onCancel,
}: {
  userId: string;
  email: string;
  details: StaffDetails;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [employers, setEmployers] = useState<StaffEmployer[]>(details.employers.length > 0 ? details.employers : [{ company: "", position: "", duration: "" }]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSaved(false);
    setMessage(undefined);
    const result = await saveStaffProfileForm(new FormData(event.currentTarget));
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    setFieldErrors({});
    setSaved(true);
    router.refresh();
    onSaved?.();
  }

  return (
    <form className="grid gap-8" onSubmit={onSubmit}>
      <input type="hidden" name="userId" value={userId} />
      {saved && <Alert tone="success" title="Profile saved" />}
      {message && <Alert tone="danger" title={message} />}

      <Section title="Basic details">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Full name" name="fullName" required maxLength={USER_LIMITS.fullName} defaultValue={details.fullName} error={fieldErrors.fullName} />
          <TextField label="Date of birth" name="dateOfBirth" type="date" defaultValue={details.dateOfBirth} error={fieldErrors.dateOfBirth} />
          <Select label="Gender" name="gender" placeholder="Choose" defaultValue={details.gender} options={GENDERS.map((value) => ({ value, label: GENDER_LABELS[value] }))} error={fieldErrors.gender} />
          <TextField label="Nationality" name="nationality" maxLength={STAFF_LIMITS.nationality} defaultValue={details.nationality} error={fieldErrors.nationality} />
          <Select label="Marital status" name="maritalStatus" placeholder="Choose" defaultValue={details.maritalStatus} options={MARITAL_STATUSES.map((value) => ({ value, label: MARITAL_LABELS[value] }))} error={fieldErrors.maritalStatus} />
        </div>
      </Section>

      <Section title="Address">
        <Address prefix="current" legend="Current address" details={details} errors={fieldErrors} />
        <Address prefix="permanent" legend="Permanent address" details={details} errors={fieldErrors} />
      </Section>

      <Section title="Contact">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <p className="m-0 type-label text-ink">Email address</p>
            <p className="m-0 text-ink">{email}</p>
          </div>
          <TextField label="Mobile number" name="mobileNumber" type="tel" maxLength={STAFF_LIMITS.phone} defaultValue={details.mobileNumber} error={fieldErrors.mobileNumber} />
          <TextField label="Alternate phone number" name="alternatePhone" type="tel" optional maxLength={STAFF_LIMITS.phone} defaultValue={details.alternatePhone} error={fieldErrors.alternatePhone} />
          <TextField label="Emergency contact name" name="emergencyName" maxLength={STAFF_LIMITS.emergencyName} defaultValue={details.emergencyName} error={fieldErrors.emergencyName} />
          <TextField label="Relationship" name="emergencyRelationship" maxLength={STAFF_LIMITS.relationship} defaultValue={details.emergencyRelationship} error={fieldErrors.emergencyRelationship} />
          <TextField label="Emergency phone" name="emergencyPhone" type="tel" maxLength={STAFF_LIMITS.phone} defaultValue={details.emergencyPhone} error={fieldErrors.emergencyPhone} />
        </div>
      </Section>

      <Section title="Education and skills">
        <div className="grid gap-5">
          <TextField label="Highest educational attainment" name="highestEducation" maxLength={STAFF_LIMITS.education} defaultValue={details.highestEducation} error={fieldErrors.highestEducation} />
          <TextField label="Certifications and licenses" name="certifications" optional multiline maxLength={STAFF_LIMITS.certifications} defaultValue={details.certifications} error={fieldErrors.certifications} />
          <TextField label="Skills" name="skills" hint="Separate skills with commas." maxLength={STAFF_LIMITS.skills} defaultValue={details.skills} error={fieldErrors.skills} />
          <TextField label="Languages spoken" name="languages" maxLength={STAFF_LIMITS.languages} defaultValue={details.languages} error={fieldErrors.languages} />
        </div>
      </Section>

      <Section title="Work experience">
        <div className="grid gap-4">
          {employers.map((job, index) => (
            <div key={index} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
              <TextField id={`employer-company-${index}`} label="Company" name="employerCompany" maxLength={STAFF_LIMITS.employer} defaultValue={job.company} />
              <TextField id={`employer-position-${index}`} label="Position" name="employerPosition" maxLength={STAFF_LIMITS.employer} defaultValue={job.position} />
              <TextField id={`employer-duration-${index}`} label="Duration" name="employerDuration" hint="For example, 2019–2022" maxLength={STAFF_LIMITS.employer} defaultValue={job.duration} />
            </div>
          ))}
          {employers.length < STAFF_LIMITS.employers && (
            <Button type="button" variant="ghost" size="sm" iconLeft="plus" onClick={() => setEmployers((rows) => [...rows, { company: "", position: "", duration: "" }])}>
              Add employer
            </Button>
          )}
          <TextField label="Key responsibilities" name="keyResponsibilities" multiline maxLength={STAFF_LIMITS.responsibilities} defaultValue={details.keyResponsibilities} error={fieldErrors.keyResponsibilities} />
          <TextField label="Achievements" name="achievements" optional multiline maxLength={STAFF_LIMITS.achievements} defaultValue={details.achievements} error={fieldErrors.achievements} />
        </div>
      </Section>

      <Section title="Résumé">
        <p className="m-0 type-body-sm text-ink-muted">
          {details.resumeName ? `Current file: ${details.resumeName}. ` : ""}
          Upload a PDF or DOCX, up to 2 MB. When the file has headings for education, skills or experience, those blank fields are filled in.
        </p>
        <input name="resume" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="block w-full text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface-sunken file:px-3 file:py-2 file:font-semibold file:text-ink" />
      </Section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          {pending ? "Saving" : "Save profile"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <h2 className="m-0 type-h3">{title}</h2>
      {children}
    </section>
  );
}

function Address({
  prefix,
  legend,
  details,
  errors,
}: {
  prefix: "current" | "permanent";
  legend: string;
  details: StaffDetails;
  errors: Partial<Record<string, string>>;
}) {
  const street = prefix === "current" ? "currentStreet" : "permanentStreet";
  const city = prefix === "current" ? "currentCity" : "permanentCity";
  const province = prefix === "current" ? "currentProvince" : "permanentProvince";
  const postal = prefix === "current" ? "currentPostalCode" : "permanentPostalCode";
  return (
    <fieldset className="m-0 grid gap-4 rounded-lg border border-border p-4">
      <legend className="px-1 type-label">{legend}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Street" name={street} maxLength={STAFF_LIMITS.street} defaultValue={details[street]} error={errors[street]} />
        <TextField label="City" name={city} maxLength={STAFF_LIMITS.city} defaultValue={details[city]} error={errors[city]} />
        <TextField label="Province" name={province} maxLength={STAFF_LIMITS.province} defaultValue={details[province]} error={errors[province]} />
        <TextField label="Postal code" name={postal} maxLength={STAFF_LIMITS.postalCode} defaultValue={details[postal]} error={errors[postal]} />
      </div>
    </fieldset>
  );
}
