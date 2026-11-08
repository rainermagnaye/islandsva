"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { PasswordField } from "@/components/ui/password-field";
import { setPassword } from "../actions";
import { PASSWORD_RULES, type NewPasswordField } from "../contract";

export function SetPasswordForm() {
  return (
    <Form<NewPasswordField> aria-label="Choose a password" onSubmit={setPassword}>
      {({ pending, fieldErrors }) => (
        <>
          <PasswordField
            label="New password"
            name="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_RULES.min}
            maxLength={PASSWORD_RULES.max}
            hint={`At least ${PASSWORD_RULES.min} characters, with letters and numbers.`}
            error={fieldErrors.password}
          />
          <PasswordField
            label="Confirm password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            maxLength={PASSWORD_RULES.max}
            error={fieldErrors.confirmPassword}
          />
          <div>
            <Button type="submit" loading={pending}>
              {pending ? "Saving" : "Save password"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
