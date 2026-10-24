"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { formatPrice } from "@/content/packages";
import { activateClient, recordClientPayment, resendClientAccount, voidClientPaymentAction } from "../activation-actions";
import { PAYMENT_LIMITS, PAYMENT_STATUS_LABELS, activationBlockers, type Payment, type PaymentField } from "../activation-contract";
import type { ClientDetail } from "../contract";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Payment (recorded by hand: no money moves through the app) and activation. Activating creates the client's
 * login and emails them a link to choose a password; the link itself is never shown here.
 */
export function ActivationPanel({ client, payments }: { client: ClientDetail; payments: readonly Payment[] }) {
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const isPending = client.status === "pending";
  const blockers = activationBlockers(client, payments);

  function run(action: () => Promise<{ ok: true; emailed?: boolean } | { ok: false; message: string }>, done: (emailed?: boolean) => string) {
    setProblem(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) setNotice(done("emailed" in result ? result.emailed : undefined));
      else setProblem(result.message);
      setConfirming(false);
    });
  }

  return (
    <Card as="section" padding="sm" aria-labelledby="activation-title" className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="activation-title" className="m-0 type-label">
          Payment and activation
        </h2>
        {client.status === "active" && (
          <Badge tone="success" size="sm">
            Active{client.activatedAt ? ` since ${day.format(new Date(client.activatedAt))}` : ""}
          </Badge>
        )}
      </div>

      {payments.length > 0 ? (
        <ul className="m-0 grid list-none gap-2 p-0">
          {payments.map((payment) => (
            <li key={payment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 type-body-sm">
              <span className="type-label">{formatPrice(payment.amountCents)}</span>
              <span className="text-ink-muted">
                {day.format(new Date(payment.paidOn))}
                {payment.reference ? ` · ${payment.reference}` : ""}
              </span>
              <Badge tone={payment.status === "paid" ? "success" : "neutral"} size="sm">
                {PAYMENT_STATUS_LABELS[payment.status]}
              </Badge>
              {isPending && payment.status === "paid" && (
                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => voidClientPaymentAction(client.id, payment.id), () => "Payment voided.")}>
                  Void
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 type-body-sm text-ink-muted">No payment recorded yet.</p>
      )}

      {isPending && (
        <Form<PaymentField> aria-label="Mark as paid" onSubmit={recordClientPayment} className="gap-3 border-t border-border pt-4">
          {({ pending: saving, fieldErrors }) => (
            <>
              <input type="hidden" name="clientId" value={client.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField
                  compact
                  label="Amount received (USD)"
                  name="amount"
                  inputMode="decimal"
                  required
                  defaultValue={client.monthlyCents ? (client.monthlyCents / 100).toFixed(2) : ""}
                  error={fieldErrors.amount}
                />
                <TextField compact label="Date received" name="paidOn" type="date" required max={today()} defaultValue={today()} error={fieldErrors.paidOn} />
                <TextField compact label="Reference" name="reference" optional maxLength={PAYMENT_LIMITS.reference} hint="Bank or transfer reference." error={fieldErrors.reference} />
              </div>
              <div>
                <Button type="submit" variant="secondary" size="sm" loading={saving}>
                  {saving ? "Saving" : "Mark as paid"}
                </Button>
              </div>
            </>
          )}
        </Form>
      )}

      {notice && <Alert tone="success" title={notice} />}
      {problem && <Alert tone="danger" title={problem} />}

      {isPending ? (
        <div className="grid gap-2 border-t border-border pt-4">
          {blockers.length > 0 ? (
            <ul className="m-0 grid list-disc gap-1 pl-5 type-body-sm text-ink-muted">
              {blockers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="m-0 type-body-sm text-ink-muted">Ready. Activating creates their login and emails them a link to choose a password.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {confirming ? (
              <>
                <Button type="button" size="sm" loading={pending} onClick={() => run(() => activateClient(client.id), (emailed) => (emailed ? "Activated. We emailed their sign-in link." : "Activated, but the email didn't go out. Use Resend account email."))}>
                  Yes, activate {client.companyName}
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" iconLeft="check" disabled={blockers.length > 0 || pending} onClick={() => setConfirming(true)}>
                Activate client
              </Button>
            )}
          </div>
        </div>
      ) : (
        client.status === "active" && (
          <div className="border-t border-border pt-4">
            <Button type="button" variant="ghost" size="sm" iconLeft="mail" loading={pending} onClick={() => run(() => resendClientAccount(client.id), (emailed) => (emailed ? "We emailed a fresh sign-in link." : "The email didn't go out. Please try again later."))}>
              Resend account email
            </Button>
          </div>
        )
      )}
    </Card>
  );
}
