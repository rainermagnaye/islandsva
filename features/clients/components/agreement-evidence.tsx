import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { agreementApprovable } from "../agreement";
import type { AgreementReview } from "../service";

// Server-rendered pieces of the admin review: the agreement evidence and the payment checklist. They reach the client
// profile as children, so they add markup, not JavaScript.

const at = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });


/**
 * The agreement behind a registration: the acceptance and its evidence, or the earlier consent form. `forApproval`
 * (the review) adds whether it can be approved and what to do if not; the Consents tab shows the record only.
 */
export function AgreementEvidence({ review, forApproval }: { review: AgreementReview | null; forApproval: boolean }) {
  const accepted = review?.accepted ?? null;
  if (!forApproval && !accepted && review?.state !== "legacy") {
    return <EmptyState compact title="No agreement yet" description="The accepted agreement appears here once the customer accepts it on their registration link." />;
  }
  return (
    <Card as="section" padding="md" className="grid gap-3" aria-label="Agreement">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="m-0 type-label">Agreement</h2>
        {forApproval && review?.state === "current" && <Badge tone="success">Accepted</Badge>}
        {forApproval && review?.state === "legacy" && <Badge tone="info">Earlier consent</Badge>}
        {forApproval && !agreementApprovable(review?.state) && <Badge tone="warning">Not approvable</Badge>}
      </div>
      {forApproval && review?.state === "stale" && (
        <Alert tone="warning" title="The terms changed after the client accepted">
          The company, country or package is different now. Send the Agreement back so they accept the current terms before you approve.
        </Alert>
      )}
      {forApproval && (review?.state === "missing" || !review) && (
        <Alert tone="warning" title="No agreement accepted">
          Send the Agreement back so the client accepts it before you approve.
        </Alert>
      )}
      {review?.state === "legacy" && <p className="m-0 type-body-sm">Signed with the earlier consent form.</p>}
      {accepted && (
        <>
          <dl className="m-0 grid gap-3 sm:grid-cols-2">
            <Item label="Signed by" value={accepted.signerName} />
            <Item label="Accepted" value={`${at.format(new Date(accepted.acceptedAt))} UTC`} />
            <Item label="Version" value={accepted.version} />
            <Item label="Contact email on file" value={accepted.contactEmailOnFile} />
            <Item label="IP address recorded" value={accepted.ipRecorded ? "Yes (hashed)" : "No"} />
          </dl>
          <details className="rounded-md border border-border">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 type-label">Agreement text</summary>
            <p className="m-0 border-t border-border p-3 whitespace-pre-wrap type-body-sm">{accepted.body}</p>
          </details>
        </>
      )}
    </Card>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="type-caption text-ink-muted">{label}</dt>
      <dd className="m-0 break-words type-body-sm">{value}</dd>
    </div>
  );
}

const CHECKS = [
  "Proof of payment uploaded",
  "Client and transaction can be identified",
  "Amount matches the agreed terms",
  "Funds confirmed in the receiving account",
  "Not already credited to another client",
  "Reference recorded below",
] as const;

/**
 * What the admin confirms before approving. Every box is required, so the browser won't submit the form until all are
 * ticked. Unnamed, so nothing is sent or stored.
 */
export function PaymentChecklist() {
  return (
    <fieldset className="m-0 grid gap-1 border-0 p-0">
      <legend className="mb-1 type-label">Before you approve</legend>
      {CHECKS.map((label, index) => (
        <Checkbox key={label} id={`payment-check-${index + 1}`} label={label} required />
      ))}
    </fieldset>
  );
}
