"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { setPassword } from "../actions";
import { PASSWORD_RULES, type NewPasswordField } from "../contract";

export function SetPasswordForm() {
  return (
    <Form<NewPasswordField> aria-label="Choose a password" onSubmit={setPassword}>
      {({ pending, fieldErrors }) => (
        <>
          <TextField
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_RULES.min}
            maxLength={PASSWORD_RULES.max}
            hint={`At least ${PASSWORD_RULES.min} characters, with letters and numbers.`}
            error={fieldErrors.password}
          />
          <TextField
            label="Confirm password"
            name="confirmPassword"
            type="password"
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
