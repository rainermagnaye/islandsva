"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { compactControlClasses } from "@/components/ui/field";
import { AttachmentField } from "@/components/ui/attachment-field";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import type { SubmitResult } from "@/types/form";
import type { EmployeeDetailField, EmployeeDetails, EmployeeEmployer, EmployeeReference } from "../contract";
import {
  GENDER_LABELS,
  MARITAL_LABELS,
  REGISTRATION_STATUS_LABELS,
  REVIEW_SECTIONS,
  EMPLOYEE_LIMITS,
  USER_LIMITS,
  type ReviewSection,
} from "../employee-fields";
import {
  COUNTRIES,
  EDUCATION_LEVELS,
  LANGUAGES,
  formatProfileDate,
  genderChoices,
  joinDuration,
  maritalChoices,
  splitDuration,
  withCurrent,
  type EmployeeProfileMeta,
} from "../profile-fields";
import { saveOwnEmployeeProfile, saveEmployeeProfileForm } from "../actions";

const RESUME_TOO_LARGE = "Keep the résumé under 2 MB.";
const PHOTO_TOO_LARGE = "Keep the profile picture under 512 KB.";
const SAVE_FAILED = "We couldn't save the profile. Check your connection and try again.";

const FORM_ID = "employee-profile";

/**
 * Same cards as the read-only profile. Each value is an input of the same cell size; the sections stay where they are.
 * The picture is chosen in the header and passed in here, then attached to this submit.
 */
export function EmployeeProfileForm({
  userId,
  email,
  details,
  meta,
  profilePic,
  onSaved,
  onCancel,
  mode = "admin",
  sections = REVIEW_SECTIONS,
}: {
  userId: string;
  email: string;
  details: EmployeeDetails;
  meta: EmployeeProfileMeta;
  profilePic: File | null;
  onSaved?: () => void;
  onCancel?: () => void;
  /** review = the VA is saving their own profile. */
  mode?: "admin" | "review";
  sections?: readonly ReviewSection[];
}) {
  const show = (section: ReviewSection) => sections.includes(section);
  const picture = useRef(profilePic);
  useEffect(() => {
    picture.current = profilePic;
  }, [profilePic]);
  const [employers, setEmployers] = useState<EmployeeEmployer[]>(
    details.employers.length > 0 ? details.employers : [{ company: "", position: "", duration: "" }],
  );
  const [references, setReferences] = useState<EmployeeReference[]>(
    details.references.length > 0 ? details.references : [{ name: "", phone: "", relationship: "", company: "", email: "" }],
  );

  async function submit(formData: FormData): Promise<SubmitResult<EmployeeDetailField | "email">> {
    const photo = picture.current;
    if (photo && photo.size > 0) formData.set("avatar", photo);
    const resume = formData.get("resume");
    if (resume instanceof File && resume.size > EMPLOYEE_LIMITS.resumeBytes) return { ok: false, message: RESUME_TOO_LARGE };
    const avatar = formData.get("avatar");
    if (avatar instanceof File && avatar.size > EMPLOYEE_LIMITS.avatarBytes) return { ok: false, message: PHOTO_TOO_LARGE };
    try {
      const result = mode === "review" ? await saveOwnEmployeeProfile(formData) : await saveEmployeeProfileForm(formData);
      if (result.ok) onSaved?.();
      return result;
    } catch {
      return { ok: false, message: SAVE_FAILED };
    }
  }

  return (
    <Form<EmployeeDetailField | "email"> id={FORM_ID} aria-label="Employee profile" onSubmit={submit}>
      {({ pending, fieldErrors }) => (
        <div className="grid gap-4">
          <input type="hidden" name="userId" value={userId} />
          <div className={sections.length === 1 ? "grid gap-4" : "grid items-start gap-4 lg:grid-cols-2"}>
            <div className={sections.length === 1 ? "contents" : "grid gap-4"}>
              {show("basic") && <Section title="Basic details">
                <TextField compact label="Full name" name="fullName" required placeholder="Enter full name" maxLength={USER_LIMITS.fullName} defaultValue={details.fullName} error={fieldErrors.fullName} />
                <TextField compact label="Date of birth" name="dateOfBirth" type="date" defaultValue={details.dateOfBirth} error={fieldErrors.dateOfBirth} />
                <Select compact label="Gender" name="gender" placeholder="Choose gender" defaultValue={details.gender} options={genderChoices(details.gender).map((value) => ({ value, label: GENDER_LABELS[value] }))} error={fieldErrors.gender} />
                <Select compact label="Nationality" name="nationality" placeholder="Choose nationality" defaultValue={details.nationality} options={withCurrent(COUNTRIES, details.nationality)} error={fieldErrors.nationality} />
                <Select compact label="Marital status" name="maritalStatus" placeholder="Choose marital status" defaultValue={details.maritalStatus} options={maritalChoices(details.maritalStatus).map((value) => ({ value, label: MARITAL_LABELS[value] }))} error={fieldErrors.maritalStatus} />
              </Section>}
              {show("address") && <Section title="Address information">
                <AddressFields details={details} fieldErrors={fieldErrors} />
              </Section>}
              {show("skills") && <Section title="Education and skills">
                <Select compact label="Highest education" name="highestEducation" placeholder="Choose highest education" defaultValue={details.highestEducation} options={withCurrent(EDUCATION_LEVELS, details.highestEducation)} error={fieldErrors.highestEducation} />
                <LanguageField defaultValue={details.languages} error={fieldErrors.languages} />
                <SkillField defaultValue={details.skills} error={fieldErrors.skills} />
                <div className="sm:col-span-2 grid gap-3">
                  {details.resumeName ? (
                    <a href={`/admin/users/${userId}/resume`} className="type-body-sm text-link">
                      {details.resumeName}
                    </a>
                  ) : (
                    <ReadOnly label="Résumé" value="Not provided" />
                  )}
                  <AttachmentField
                    compact
                    fileName="resume"
                    nameField="resumeName"
                    label={details.resumeName ? "Replace the résumé" : "Résumé file"}
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    hint="A PDF or DOCX, up to 2 MB. Click the name to rename it."
                  />
                </div>
                <Wide>
                  <TextField compact label="Certifications" name="certifications" optional multiline placeholder="Enter certifications" maxLength={EMPLOYEE_LIMITS.certifications} defaultValue={details.certifications} error={fieldErrors.certifications} />
                </Wide>
              </Section>}
            </div>
            <div className={sections.length === 1 ? "contents" : "grid gap-4"}>
              {show("contact") && <Section title="Contact information">
                {mode === "review" ? <ReadOnly label="Email" value={email} /> : <TextField compact label="Email" name="email" type="email" required placeholder="Enter email address" maxLength={USER_LIMITS.email} defaultValue={email} error={fieldErrors.email} />}
                <TextField compact label="Mobile number" name="mobileNumber" type="tel" placeholder="Enter mobile number" maxLength={EMPLOYEE_LIMITS.phone} defaultValue={details.mobileNumber} error={fieldErrors.mobileNumber} />
                <TextField compact label="Alternate phone" name="alternatePhone" type="tel" optional placeholder="Enter alternate phone" maxLength={EMPLOYEE_LIMITS.phone} defaultValue={details.alternatePhone} error={fieldErrors.alternatePhone} />
                <TextField compact label="Emergency contact name" name="emergencyName" placeholder="Enter contact name" maxLength={EMPLOYEE_LIMITS.emergencyName} defaultValue={details.emergencyName} error={fieldErrors.emergencyName} />
                <TextField compact label="Relationship" name="emergencyRelationship" placeholder="Enter relationship" maxLength={EMPLOYEE_LIMITS.relationship} defaultValue={details.emergencyRelationship} error={fieldErrors.emergencyRelationship} />
                <TextField compact label="Emergency phone" name="emergencyPhone" type="tel" placeholder="Enter phone number" maxLength={EMPLOYEE_LIMITS.phone} defaultValue={details.emergencyPhone} error={fieldErrors.emergencyPhone} />
              </Section>}
              {show("experience") && <>
              <Section title="Work experience">
                {employers.map((job, index) => (
                  <EmployerFields key={index} index={index} job={job} />
                ))}
                {employers.length < EMPLOYEE_LIMITS.employers && (
                  <div className="sm:col-span-2">
                    <Button type="button" variant="ghost" size="sm" iconLeft="plus" onClick={() => setEmployers((rows) => [...rows, { company: "", position: "", duration: "" }])}>
                      Add employer
                    </Button>
                  </div>
                )}
                <Wide>
                  <TextField compact label="Key responsibilities" name="keyResponsibilities" multiline placeholder="Enter responsibilities" maxLength={EMPLOYEE_LIMITS.responsibilities} defaultValue={details.keyResponsibilities} error={fieldErrors.keyResponsibilities} />
                </Wide>
                <Wide>
                  <TextField compact label="Achievements" name="achievements" optional multiline placeholder="Enter achievements" maxLength={EMPLOYEE_LIMITS.achievements} defaultValue={details.achievements} error={fieldErrors.achievements} />
                </Wide>
              </Section>
              <Section title="References">
                {references.map((person, index) => (
                  <ReferenceFields key={index} index={index} person={person} />
                ))}
                {references.length < EMPLOYEE_LIMITS.references && (
                  <div className="sm:col-span-2">
                    <Button type="button" variant="ghost" size="sm" iconLeft="plus" onClick={() => setReferences((rows) => [...rows, { name: "", phone: "", relationship: "", company: "", email: "" }])}>
                      Add reference
                    </Button>
                  </div>
                )}
              </Section>
              </>}
            </div>
            {mode === "admin" && <div className="lg:col-span-2">
              <Section title="System metadata">
                <ReadOnly label="Registration status" value={REGISTRATION_STATUS_LABELS[meta.registrationStatus]} />
                <ReadOnly label="Progress tracker" value={meta.progress} />
                <ReadOnly label="Date of invitation sent" value={formatProfileDate(meta.invitationSentAt)} />
                <ReadOnly label="Date of registration completed" value={formatProfileDate(meta.registrationCompletedAt)} />
              </Section>
            </div>}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={pending}>
              {pending ? (mode === "review" ? "Sending" : "Saving") : mode === "review" ? "Send for review" : "Save profile"}
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

function AddressFields({ details, fieldErrors }: { details: EmployeeDetails; fieldErrors: Partial<Record<EmployeeDetailField, string>> }) {
  const prefix = "current";
  const name = (suffix: "Street" | "Line2" | "City" | "Province" | "PostalCode" | "Country") => `${prefix}${suffix}` as EmployeeDetailField;
  const value = (suffix: "Street" | "Line2" | "City" | "Province" | "PostalCode" | "Country") => details[name(suffix)];
  return (
    <div className="grid gap-3 sm:col-span-2">
      <TextField compact label="Street address" name={name("Street")} placeholder="Enter street address" maxLength={EMPLOYEE_LIMITS.street} defaultValue={value("Street")} error={fieldErrors[name("Street")]} />
      <TextField compact label="Additional info" name={name("Line2")} optional placeholder="Apartment, floor, landmark" maxLength={EMPLOYEE_LIMITS.street} defaultValue={value("Line2")} error={fieldErrors[name("Line2")]} />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField compact label="City" name={name("City")} placeholder="Enter city" maxLength={EMPLOYEE_LIMITS.city} defaultValue={value("City")} error={fieldErrors[name("City")]} />
        <TextField compact label="State" name={name("Province")} placeholder="Enter state" maxLength={EMPLOYEE_LIMITS.province} defaultValue={value("Province")} error={fieldErrors[name("Province")]} />
        <TextField compact label="Postal code" name={name("PostalCode")} placeholder="Enter postal code" maxLength={EMPLOYEE_LIMITS.postalCode} defaultValue={value("PostalCode")} error={fieldErrors[name("PostalCode")]} />
      </div>
      <Select compact label="Country" name={name("Country")} optional placeholder="Choose country" defaultValue={value("Country")} options={withCurrent(COUNTRIES, value("Country"))} error={fieldErrors[name("Country")]} />
    </div>
  );
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

function EmployerFields({ index, job }: { index: number; job: EmployeeEmployer }) {
  const parsed = splitDuration(job.duration);
  const [start, setStart] = useState(parsed.start);
  const [end, setEnd] = useState(parsed.end);

  return (
    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
      <TextField compact id={`employer-company-${index}`} label="Employer name" name="employerCompany" placeholder="Enter employer name" maxLength={EMPLOYEE_LIMITS.employer} defaultValue={job.company} />
      <TextField compact id={`employer-position-${index}`} label="Position" name="employerPosition" placeholder="Enter position" maxLength={EMPLOYEE_LIMITS.employer} defaultValue={job.position} />
      <TextField compact id={`employer-start-${index}`} label="Duration start" name={`durationStart-${index}`} type="date" value={start} onChange={(event) => setStart(event.target.value)} />
      <TextField compact id={`employer-end-${index}`} label="Duration end" name={`durationEnd-${index}`} type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
      <input type="hidden" name="employerDuration" value={joinDuration(start, end, job.duration)} />
    </div>
  );
}

function ReferenceFields({ index, person }: { index: number; person: EmployeeReference }) {
  return (
    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
      <TextField compact id={`reference-name-${index}`} label="Name" name="referenceName" placeholder="Enter name" maxLength={EMPLOYEE_LIMITS.emergencyName} defaultValue={person.name} />
      <TextField compact id={`reference-email-${index}`} label="Email" name="referenceEmail" type="email" placeholder="Enter email address" maxLength={USER_LIMITS.email} defaultValue={person.email} />
      <TextField compact id={`reference-phone-${index}`} label="Number" name="referencePhone" type="tel" placeholder="Enter number" maxLength={EMPLOYEE_LIMITS.phone} defaultValue={person.phone} />
      <TextField compact id={`reference-company-${index}`} label="Company" name="referenceCompany" placeholder="Enter company" maxLength={EMPLOYEE_LIMITS.employer} defaultValue={person.company} />
      <Wide>
        <TextField compact id={`reference-relationship-${index}`} label="Relationship" name="referenceRelationship" placeholder="Enter relationship" maxLength={EMPLOYEE_LIMITS.relationship} defaultValue={person.relationship} />
      </Wide>
    </div>
  );
}

function SkillField({ defaultValue, error }: { defaultValue: string; error?: string }) {
  const [skills, setSkills] = useState(() => defaultValue.split(",").map((skill) => skill.trim()).filter(Boolean));
  const [draft, setDraft] = useState("");

  function add(value: string) {
    const next = value.trim();
    if (!next || skills.includes(next)) return;
    setSkills((current) => [...current, next]);
    setDraft("");
  }

  return (
    <div className="grid min-w-0 content-start gap-1 sm:col-span-2">
      <label htmlFor="field-skill-draft" className="type-caption text-ink-muted">
        Skills
      </label>
      <input type="hidden" name="skills" value={skills.join(", ")} />
      <div className={compactControlClasses + " flex items-center gap-1 overflow-hidden"}>
        <ul className="m-0 flex min-w-0 list-none gap-1 overflow-hidden p-0">
          {skills.map((skill) => (
            <li key={skill} className="shrink-0">
              <button type="button" className="type-caption text-ink" onClick={() => setSkills((current) => current.filter((item) => item !== skill))}>
                {skill}
                <span className="sr-only">Remove {skill}</span>
                <span aria-hidden="true"> ×</span>
              </button>
            </li>
          ))}
        </ul>
        <input
          id="field-skill-draft"
          name="skillDraft"
          value={draft}
          placeholder="Enter a skill"
          maxLength={EMPLOYEE_LIMITS.skills}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(draft);
            }
          }}
          onBlur={() => add(draft)}
          className="min-w-16 flex-1 border-0 bg-transparent p-0 type-body-sm text-ink outline-none placeholder:text-ink-muted"
        />
      </div>
      {error && <p className="m-0 type-label text-status-danger">{error}</p>}
    </div>
  );
}

function LanguageField({ defaultValue, error }: { defaultValue: string; error?: string }) {
  const saved = defaultValue.split(",").map((language) => language.trim()).filter(Boolean);
  const extras = saved.filter((language) => !(LANGUAGES as readonly string[]).includes(language));
  const unique = [...LANGUAGES, ...extras];
  const [selected, setSelected] = useState(saved);

  function toggle(language: string) {
    setSelected((current) => (current.includes(language) ? current.filter((item) => item !== language) : [...current, language]));
  }

  return (
    <div className="grid min-w-0 content-start gap-1 sm:col-span-2">
      <label htmlFor="field-languages" className="type-caption text-ink-muted">
        Languages
      </label>
      <input type="hidden" name="languages" value={selected.join(", ")} />
      <details className="relative w-full min-w-0 max-w-full">
        <summary id="field-languages" className={compactControlClasses + " cursor-pointer list-none truncate"}>
          {selected.length > 0 ? selected.join(", ") : "Choose languages"}
        </summary>
        <ul className="absolute z-10 m-0 mt-1 max-h-48 w-full list-none overflow-auto rounded-md border border-border bg-surface-card p-2 elevation-md">
          {unique.map((language) => (
            <li key={language}>
              <label className="flex min-h-9 cursor-pointer items-center gap-2 px-2 type-body-sm text-ink">
                <input type="checkbox" checked={selected.includes(language)} onChange={() => toggle(language)} />
                {language}
              </label>
            </li>
          ))}
        </ul>
      </details>
      {error && <p className="m-0 type-label text-status-danger">{error}</p>}
    </div>
  );
}
