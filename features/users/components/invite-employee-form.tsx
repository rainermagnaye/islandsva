"use client";

import { Button } from "@/components/ui/button";
import { Form, FormSuccess } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { inviteEmployee } from "../actions";
import { EMPLOYEE_ROLES, USER_LIMITS, type InviteField } from "../contract";

export function InviteEmployeeForm() {
  return (
    <Form<InviteField>
      aria-label="Invite a team member"
      onSubmit={inviteEmployee}
      success={
        <FormSuccess align="center" title="Invitation sent">
          They&apos;ll get an email with a link to choose a password. The link expires in 24 hours.
        </FormSuccess>
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
          <div>
            <Button type="submit" loading={pending} iconLeft="plus">
              {pending ? "Sending" : "Send invitation"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
