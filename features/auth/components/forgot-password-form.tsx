"use client";

import { Button } from "@/components/ui/button";
import { Form, FormSuccess } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { requestPasswordReset } from "../actions";
import type { EmailField } from "../contract";

export function ForgotPasswordForm() {
  return (
    <Form<EmailField>
      aria-label="Reset your password"
      onSubmit={requestPasswordReset}
      success={
        <FormSuccess title="Check your email">
          If an account uses that address, we&apos;ve sent a link to choose a new password. It works once and expires in 24 hours.
        </FormSuccess>
      }
    >
      {({ pending, fieldErrors }) => (
        <>
          <TextField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} error={fieldErrors.email} />
          <div>
            <Button type="submit" loading={pending}>
              {pending ? "Sending" : "Email me a reset link"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
