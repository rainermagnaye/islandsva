"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Form, FormSuccess } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { createEmployeeProfile, inviteEmployee } from "../actions";
import { EMPLOYEE_ROLES, USER_LIMITS, type InviteField } from "../contract";

type Intent = "invite" | "create";

/**
 * Send invitation creates the account and emails the link. Create only makes the account and profile;
 * the invitation is sent later from the profile. The clicked button sets the intent before the form submits
 * (Enter submits through the first button, which also fires its click).
 */
export function InviteEmployeeForm() {
  const intentRef = useRef<Intent>("invite");
  const [intent, setIntent] = useState<Intent>("invite");

  function choose(next: Intent) {
    intentRef.current = next;
    setIntent(next);
  }

  return (
    <Form<InviteField>
      aria-label="Invite a team member"
      onSubmit={(formData) => (intentRef.current === "create" ? createEmployeeProfile(formData) : inviteEmployee(formData))}
      success={
        intent === "create" ? (
          <FormSuccess align="center" title="Profile created" />
        ) : (
          <FormSuccess align="center" title="Invitation sent">
            They&apos;ll get an email with a link to choose a password. The link expires in 24 hours.
          </FormSuccess>
        )
      }
    >
      {({ pending, fieldErrors }) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Full name" name="fullName" autoComplete="off" required maxLength={USER_LIMITS.fullName} error={fieldErrors.fullName} data-autofocus />
            <TextField label="Work email" name="email" type="email" autoComplete="off" required maxLength={USER_LIMITS.email} error={fieldErrors.email} />
          </div>
          <Select
            label="Role"
            name="role"
            required
            placeholder="Choose a role"
            options={EMPLOYEE_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
            hint="Admins must set up two-factor sign-in the first time they sign in."
            error={fieldErrors.role}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={pending && intent === "invite"} disabled={pending} iconLeft="plus" onClick={() => choose("invite")}>
              {pending && intent === "invite" ? "Sending" : "Send invitation"}
            </Button>
            <Button type="submit" variant="ghost" loading={pending && intent === "create"} disabled={pending} onClick={() => choose("create")}>
              {pending && intent === "create" ? "Creating" : "Create"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
