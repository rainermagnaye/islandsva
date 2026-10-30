"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { confirmClientRegistration } from "../actions";
import { PAYMENT_RECEIVED_LIMITS, type PaymentReceivedField } from "../contract";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Approving a registration records the payment the client's proof shows (the amount received, any bank or transfer
 * fee, the date it arrived and its reference), then sends the password invite. The sales summary totals these. The
 * amount starts at the client's agreed monthly price. The checklist (server-rendered) must be fully ticked: until the
 * form is valid the button looks disabled (CSS only) and the browser won't submit it. `approvable` is false while the
 * agreement doesn't cover the current terms; the database refuses then anyway.
 */
export function ConfirmPaymentForm({
  clientId,
  monthlyCents,
  checklist,
  approvable,
  onDone,
  secondary,
}: {
  clientId: string;
  monthlyCents: number | null;
  checklist: ReactNode;
  approvable: boolean;
  onDone: () => void;
  secondary: ReactNode;
}) {
  return (
    <Form<PaymentReceivedField>
      aria-label="Approve the registration and record the payment"
      onSubmit={async (formData) => {
        const result = await confirmClientRegistration(formData);
        if (result.ok) onDone();
        return result;
      }}
      className="group gap-4 border-t border-border pt-4"
    >
      {({ pending, fieldErrors }) => (
        <>
          <input type="hidden" name="clientId" value={clientId} />
          {checklist}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              compact
              label="Amount received (USD)"
              name="amount"
              inputMode="decimal"
              required
              defaultValue={monthlyCents ? (monthlyCents / 100).toFixed(2) : ""}
              error={fieldErrors.amount}
            />
            <TextField compact label="Fee (USD)" name="fee" inputMode="decimal" optional hint="Bank or transfer fee taken out." error={fieldErrors.fee} />
            <TextField compact label="Date received" name="paidOn" type="date" required max={today()} defaultValue={today()} error={fieldErrors.paidOn} />
            <TextField compact label="Reference" name="reference" required maxLength={PAYMENT_RECEIVED_LIMITS.reference} hint="Bank or transfer reference." error={fieldErrors.reference} />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {secondary}
            <Button
              type="submit"
              loading={pending}
              disabled={!approvable}
              className="group-invalid:border-transparent group-invalid:bg-disabled-fill group-invalid:text-disabled-ink"
            >
              {pending ? "Approving" : "Approve and send invite"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
