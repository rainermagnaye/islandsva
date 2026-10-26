"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import type { ShortlistEntry } from "../contract";
import { decideShortlist } from "../actions";

/** The client's offers. Accepting one creates the assignment. */
export function MatchList({ offers }: { offers: readonly ShortlistEntry[] }) {
  const open = offers.filter((offer) => offer.status === "offered");
  const chosen = offers.filter((offer) => offer.status === "accepted");

  return (
    <div className="grid gap-4">
      {open.length === 0 ? (
        <Card padding="sm">
          <p className="m-0 type-body-sm text-ink-muted">There are no VAs to choose from yet. Your Islands VA contact will offer a shortlist here.</p>
        </Card>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {open.map((offer) => (
            <li key={offer.id}>
              <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
                <p className="m-0 type-body text-ink">
                  <span className="type-label">{offer.vaFirstName}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Decision id={offer.id} status="accepted" label="Accept" pendingLabel="Accepting" />
                  <Decision id={offer.id} status="declined" label="Decline" pendingLabel="Declining" />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {chosen.length > 0 && (
        <Card padding="sm">
          <h2 className="m-0 type-label">Working with you</h2>
          <ul className="m-0 mt-2 list-none p-0">
            {chosen.map((offer) => (
              <li key={offer.id} className="type-body-sm text-ink">
                {offer.vaFirstName}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Decision({ id, status, label, pendingLabel }: { id: string; status: "accepted" | "declined"; label: string; pendingLabel: string }) {
  return (
    <Form aria-label={label} onSubmit={decideShortlist}>
      {({ pending }) => (
        <>
          <input type="hidden" name="shortlistId" value={id} />
          <input type="hidden" name="status" value={status} />
          <Button type="submit" variant={status === "accepted" ? "primary" : "ghost"} size="sm" loading={pending}>
            {pending ? pendingLabel : label}
          </Button>
        </>
      )}
    </Form>
  );
}
