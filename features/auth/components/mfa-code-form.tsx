"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { verifyMfa } from "../actions";
import type { MfaField } from "../contract";

/** The 6-digit authenticator code for `factorId` — used both to finish setup and at every admin sign-in. */
export function MfaCodeForm({ factorId, submitLabel }: { factorId: string; submitLabel: string }) {
  return (
    <Form<MfaField> aria-label="Authenticator code" onSubmit={verifyMfa}>
      {({ pending, fieldErrors }) => (
        <>
          <input type="hidden" name="factorId" value={factorId} />
          <TextField
            label="6-digit code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            error={fieldErrors.code}
          />
          <div>
            <Button type="submit" loading={pending}>
              {pending ? "Checking" : submitLabel}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
