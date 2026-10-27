"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { COUNTRIES, EDUCATION_LEVELS, formatProfileDate, genderChoices, maritalChoices, withCurrent, type EmployeeProfileMeta } from "../profile-fields";
import { saveOwnEmployeeProfile, saveEmployeeProfileForm } from "../actions";
import { Wide, EmployerFields, ReferenceFields, SkillField, LanguageField } from "./employee-profile-inputs";

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
