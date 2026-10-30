"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FileField } from "@/components/ui/file-field";
import { Form } from "@/components/ui/form";
import { saveRegistrationProofAction } from "../registration-actions";
import type { PaymentProofStepField } from "../contract";
import { PAYMENT_PROOF_ACCEPT } from "../payment-proof";
import { ReadOnly, Section, Wide } from "./registration-section";

/** Step 3: the payment proof. The package and payment instructions arrive as server-rendered children. */
export function PaymentStep({ token, currentProof, last, children }: { token: string; currentProof: string | null; last: boolean; children: ReactNode }) {
  return (
    <Form<PaymentProofStepField> aria-label="Payment proof" onSubmit={saveRegistrationProofAction}>
      {({ pending, fieldErrors }) => (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {children}
          <div className="grid gap-4">
            <input type="hidden" name="token" value={token} />
            <Section title="Payment proof">
              <Wide>
                {currentProof ? <ReadOnly label="Current receipt" value={currentProof} /> : null}
                <FileField
                  compact
                  label={currentProof ? "Replace the receipt" : "Receipt"}
                  name="proof"
                  required
                  accept={PAYMENT_PROOF_ACCEPT}
                  hint="PDF, JPG, PNG or WebP, up to 2 MB."
                  error={fieldErrors.proof}
                />
              </Wide>
            </Section>
            <div>
              <Button type="submit" loading={pending}>
                {pending ? "Uploading" : last ? "Upload and send for review" : "Upload and continue"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Form>
  );
}
