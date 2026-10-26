"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { endClientVa } from "@/features/clients/assignment-actions";
import type { ShortlistEntry } from "../contract";
import { offerClientVa, withdrawShortlist } from "../actions";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** Offers and the VAs already working with this client. Admins only. */
export function ShortlistAdmin({
  clientId,
  assignments,
  offers,
  vas,
}: {
  clientId: string;
  assignments: readonly { id: string; vaId: string; vaName: string; startedAt: string }[];
  offers: readonly ShortlistEntry[];
  vas: readonly { id: string; fullName: string }[];
}) {
  const open = offers.filter((offer) => offer.status === "offered");
  const busy = new Set([...assignments.map((row) => row.vaId), ...open.map((offer) => offer.vaId)]);
  const available = vas.filter((va) => !busy.has(va.id));

  return (
    <Card as="section" padding="sm" aria-labelledby="match-title" className="grid gap-4">
      <h2 id="match-title" className="m-0 type-label">
        VA Match
      </h2>
      <AssignmentList assignments={assignments} />
      <OfferList offers={open} />
      {open.length >= 3 ? (
        <p className="m-0 type-body-sm text-ink-muted">Three VAs are already offered. Withdraw one before offering another.</p>
      ) : available.length === 0 ? (
        <p className="m-0 type-body-sm text-ink-muted">No VA is available to offer. VAs appear here once their profile is approved in Teams.</p>
      ) : (
        <Form<"vaId"> aria-label="Offer a VA" onSubmit={offerClientVa} className="gap-3">
          {({ pending, fieldErrors }) => (
            <>
              <input type="hidden" name="clientId" value={clientId} />
              <Select compact label="Offer a VA" name="vaId" required placeholder="Choose a VA" options={available.map((va) => ({ value: va.id, label: va.fullName }))} error={fieldErrors.vaId} />
              <div>
                <Button type="submit" variant="secondary" size="sm" loading={pending}>
                  {pending ? "Offering" : "Offer VA"}
                </Button>
              </div>
            </>
          )}
        </Form>
      )}
    </Card>
  );
}

function AssignmentList({ assignments }: { assignments: readonly { id: string; vaId: string; vaName: string; startedAt: string }[] }) {
  if (assignments.length === 0) return <p className="m-0 type-body-sm text-ink-muted">No VA is working with this client yet.</p>;
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {assignments.map((assignment) => (
        <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 type-body-sm text-ink">
            <span className="type-label">{assignment.vaName}</span>
            <span className="text-ink-muted"> · since {day.format(new Date(assignment.startedAt))}</span>
          </p>
          <EndButton assignmentId={assignment.id} />
        </li>
      ))}
    </ul>
  );
}

function EndButton({ assignmentId }: { assignmentId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function end() {
    setProblem(null);
    startTransition(async () => {
      const result = await endClientVa(assignmentId);
      if (!result.ok) setProblem(result.message);
      setConfirming(false);
    });
  }

  return (
    <div className="grid gap-2">
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" loading={pending} onClick={end}>
            Yes, end the assignment
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          End assignment
        </Button>
      )}
      {problem && <Alert tone="danger" title={problem} />}
    </div>
  );
}

function OfferList({ offers }: { offers: readonly ShortlistEntry[] }) {
  if (offers.length === 0) return null;
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {offers.map((offer) => (
        <li key={offer.id} className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 type-body-sm text-ink">
            <span className="type-label">{offer.vaFirstName}</span>
            <span className="text-ink-muted"> · offered</span>
          </p>
          <Form aria-label={`Withdraw ${offer.vaFirstName}`} onSubmit={withdrawShortlist}>
            {({ pending }) => (
              <>
                <input type="hidden" name="shortlistId" value={offer.id} />
                <Button type="submit" variant="ghost" size="sm" loading={pending}>
                  Withdraw
                </Button>
              </>
            )}
          </Form>
        </li>
      ))}
    </ul>
  );
}
