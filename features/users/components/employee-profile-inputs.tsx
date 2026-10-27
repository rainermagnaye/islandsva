"use client";

import { useState, type ReactNode } from "react";
import { compactControlClasses } from "@/components/ui/field";
import { TextField } from "@/components/ui/text-field";
import type { EmployeeEmployer, EmployeeReference } from "../contract";
import { EMPLOYEE_LIMITS, USER_LIMITS } from "../employee-fields";
import { LANGUAGES, joinDuration, splitDuration } from "../profile-fields";

// Repeating and multi-value inputs for the employee profile form: employers, references, skills and
// languages.

export function Wide({ children }: { children: ReactNode }) {
  return <div className="min-w-0 sm:col-span-2">{children}</div>;
}

export function EmployerFields({ index, job }: { index: number; job: EmployeeEmployer }) {
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

export function ReferenceFields({ index, person }: { index: number; person: EmployeeReference }) {
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

export function SkillField({ defaultValue, error }: { defaultValue: string; error?: string }) {
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

export function LanguageField({ defaultValue, error }: { defaultValue: string; error?: string }) {
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
