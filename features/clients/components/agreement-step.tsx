"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { acceptAgreementAction } from "../registration-actions";
import { SIGNER_NAME_LIMIT, type AgreementAcceptanceField } from "../contract";

type AgreementStepProps = {
  token: string;
  version: string;
  /** SHA-256 of the text shown, computed on the server; the server compares it with its own render on accept. */
  fingerprint: string;
  last: boolean;
  /** The agreement, rendered on the server, so its text adds no client JavaScript. */
  children: ReactNode;
};

/** Step 2: read the agreement, tick the box (never pre-ticked) and type your name. */
export function AgreementStep({ token, version, fingerprint, last, children }: AgreementStepProps) {
  return (
    <Form<AgreementAcceptanceField> aria-label="Agreement" onSubmit={acceptAgreementAction}>
      {({ pending, fieldErrors }) => (
        <div className="grid gap-4">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="fingerprint" value={fingerprint} />
          {children}
          <div className="grid max-w-xl gap-3">
            <div className="grid gap-1">
              <Checkbox label="I have read and agree to this agreement" name="accept" value="yes" required />
              {fieldErrors.accept && <p className="m-0 type-body-sm text-status-danger">{fieldErrors.accept}</p>}
            </div>
            <TextField compact label="Type your full name to sign" name="signerName" required placeholder="Enter your full name" maxLength={SIGNER_NAME_LIMIT} autoComplete="name" error={fieldErrors.signerName} />
          </div>
          <div>
            <Button type="submit" loading={pending}>
              {pending ? "Saving" : last ? "Accept and send for review" : "Accept and continue"}
            </Button>
          </div>
        </div>
      )}
    </Form>
  );
}
