"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { FileField } from "@/components/ui/file-field";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import type { SubmitResult } from "@/types/form";
import {
  GENDERS,
  GENDER_LABELS,
  MARITAL_LABELS,
  MARITAL_STATUSES,
  STAFF_LIMITS,
  USER_LIMITS,
  type StaffDetailField,
  type StaffDetails,
  type StaffEmployer,
} from "../contract";
import { saveStaffProfileForm } from "../actions";

const RESUME_TOO_LARGE = "Keep the résumé under 2 MB.";
const SAVE_FAILED = "We couldn't save the profile. Check your connection and try again.";

/**
 * The staff profile form: every section, plus a résumé that fills blank sections when it can. Built on
 * <Form>, so pending state, the error summary and focus on the first invalid field come for free.
 */
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
  const [employers, setEmployers] = useState<StaffEmployer[]>(details.employers.length > 0 ? details.employers : [{ company: "", position: "", duration: "" }]);

  // Never throws, as <Form> expects: an oversized file is stopped before the upload (the server would
  // reject it before the action runs), and a failed request — dropped connection, body over the limit —
  // becomes a message instead of a button stuck on "Saving".
  async function submit(formData: FormData): Promise<SubmitResult<StaffDetailField>> {
    const resume = formData.get("resume");
    if (resume instanceof File && resume.size > STAFF_LIMITS.resumeBytes) return { ok: false, message: RESUME_TOO_LARGE };
    try {
      const result = await saveStaffProfileForm(formData);
      if (result.ok) onSaved?.(); // the action re-renders the page; the view shows the saved profile
      return result;
    } catch {
      return { ok: false, message: SAVE_FAILED };
    }
  }

  return (
    <Form<StaffDetailField> aria-label="Staff profile" onSubmit={submit}>
      {({ pending, fieldErrors }) => (
        <div className="grid gap-8">
          <input type="hidden" name="userId" value={userId} />

          <Panel title="Basic details">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Full name" name="fullName" required maxLength={USER_LIMITS.fullName} defaultValue={details.fullName} error={fieldErrors.fullName} />
              <TextField label="Date of birth" name="dateOfBirth" type="date" defaultValue={details.dateOfBirth} error={fieldErrors.dateOfBirth} />
              <Select label="Gender" name="gender" placeholder="Choose" defaultValue={details.gender} options={GENDERS.map((value) => ({ value, label: GENDER_LABELS[value] }))} error={fieldErrors.gender} />
              <TextField label="Nationality" name="nationality" maxLength={STAFF_LIMITS.nationality} defaultValue={details.nationality} error={fieldErrors.nationality} />
              <Select label="Marital status" name="maritalStatus" placeholder="Choose" defaultValue={details.maritalStatus} options={MARITAL_STATUSES.map((value) => ({ value, label: MARITAL_LABELS[value] }))} error={fieldErrors.maritalStatus} />
            </div>
          </Panel>

          <Panel title="Address">
            <Address prefix="current" legend="Current address" details={details} errors={fieldErrors} />
            <Address prefix="permanent" legend="Permanent address" details={details} errors={fieldErrors} />
          </Panel>

          <Panel title="Contact">
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
          </Panel>

          <Panel title="Education and skills">
            <div className="grid gap-5">
              <TextField label="Highest educational attainment" name="highestEducation" maxLength={STAFF_LIMITS.education} defaultValue={details.highestEducation} error={fieldErrors.highestEducation} />
              <TextField label="Certifications and licenses" name="certifications" optional multiline maxLength={STAFF_LIMITS.certifications} defaultValue={details.certifications} error={fieldErrors.certifications} />
              <TextField label="Skills" name="skills" hint="Separate skills with commas." maxLength={STAFF_LIMITS.skills} defaultValue={details.skills} error={fieldErrors.skills} />
              <TextField label="Languages spoken" name="languages" maxLength={STAFF_LIMITS.languages} defaultValue={details.languages} error={fieldErrors.languages} />
            </div>
          </Panel>

          <Panel title="Work experience">
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
          </Panel>

          <Panel title="Résumé">
            <FileField
              label={details.resumeName ? "Replace the résumé" : "Résumé file"}
              name="resume"
              optional
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              hint={`${details.resumeName ? `Current file: ${details.resumeName}. ` : ""}A PDF or DOCX, up to 2 MB. When the file has headings for education, skills or experience, those blank fields are filled in.`}
            />
          </Panel>

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
        </div>
      )}
    </Form>
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
  errors: Partial<Record<StaffDetailField, string>>;
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
