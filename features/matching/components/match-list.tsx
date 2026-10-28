"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import type { Tone } from "@/components/ui/tone";
import { DecideDialog, ProfileDialog, RequestDemoDialog } from "./match-dialogs";
import { OfferCard, type OfferView } from "./offer-card";

export type { OfferView };

/**
 * The client's offers: request a demo with a VA, then add them as an assistant or decline. With `direct`, the
 * client already has a VA (demos are for the first one), so offers are added or declined without a demo.
 */
export function MatchList({
  offers,
  team,
  declined,
  timeZone,
  today,
  direct,
  busyWith,
}: {
  offers: readonly OfferView[];
  team: readonly { id: string; name: string; tone: Tone; href: string }[];
  declined: readonly { id: string; name: string; offered: string }[];
  timeZone: string;
  today: string;
  direct: boolean;
  /** The VA the client already has an open demo with: one demo at a time. */
  busyWith: string | null;
}) {
  const [dialog, setDialog] = useState<{ kind: "profile" | "request" | "accepted" | "declined"; offer: OfferView } | null>(null);
  const close = () => setDialog(null);

  return (
    <div className="grid gap-7">
      {direct && offers.length > 0 && (
        <Alert tone="info" title="You already have an assistant">
          Demo calls are for choosing your first VA, so you can add or decline these offers directly.
        </Alert>
      )}

      {offers.length > 0 ? (
        <section aria-labelledby="shortlist" className="grid gap-4">
          <h2 id="shortlist" className="m-0 type-h4">
            Your shortlist <span className="font-medium text-ink-muted">· {offers.length}</span>
          </h2>
          <ul className="m-0 grid list-none gap-5 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,20rem),1fr))]">
            {offers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                direct={direct}
                busyWith={busyWith}
                onView={() => setDialog({ kind: "profile", offer })}
                onRequest={() => setDialog({ kind: "request", offer })}
                onDecide={(status) => setDialog({ kind: status, offer })}
              />
            ))}
          </ul>
        </section>
      ) : (
        <Card as="section" aria-labelledby="no-offers" className="grid justify-items-center gap-2 py-12 text-center">
          <h2 id="no-offers" className="m-0 type-h3">
            {team.length > 0 ? "No new offers right now" : "We're finding your matches"}
          </h2>
          <p className="m-0 max-w-[52ch] text-ink-muted">
            {team.length > 0
              ? "Need another VA? Ask your Islands VA contact, and new offers will show up here."
              : "Your Islands VA contact will offer VAs here. You can meet each one on a demo call before you decide."}
          </p>
        </Card>
      )}

      {team.length > 0 && (
        <section aria-labelledby="working-with-you" className="grid gap-3">
          <h2 id="working-with-you" className="m-0 type-h4">
            Working with you <span className="font-medium text-ink-muted">· {team.length}</span>
          </h2>
          <ul className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
            {team.map((va) => (
              <li key={va.id}>
                <Link href={va.href} className="flex min-h-11 items-center gap-3 rounded-md border border-border bg-surface-card px-4 py-3.5 text-ink no-underline hover:bg-surface-sunken">
                  <Avatar name={va.name} tone={va.tone} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{va.name}</span>
                  <Icon name="chevron-right" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {declined.length > 0 && (
        <details className="rounded-md border border-border bg-surface-card px-4 py-1">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Declined · {declined.length}</summary>
          <ul className="m-0 grid list-none gap-2 p-0 pb-3">
            {declined.map((offer) => (
              <li key={offer.id} className="flex items-center gap-3 type-body-sm">
                <Avatar name={offer.name} tone="sand" size="sm" />
                <span className="flex-1">{offer.name}</span>
                <span className="text-ink-muted">Offered {offer.offered}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {dialog && (
        <>
          <ProfileDialog
            open={dialog.kind === "profile"}
            onClose={close}
            offer={dialog.offer}
            direct={direct}
            blocked={!direct && dialog.offer.stage === "new" && busyWith !== null}
            onRequest={() => setDialog({ kind: "request", offer: dialog.offer })}
            onDecide={(status) => setDialog({ kind: status, offer: dialog.offer })}
          />
          <RequestDemoDialog open={dialog.kind === "request"} onClose={close} name={dialog.offer.name} slots={dialog.offer.slots} timeZone={timeZone} today={today} />
          <DecideDialog open={dialog.kind === "accepted" || dialog.kind === "declined"} onClose={close} offerId={dialog.offer.id} name={dialog.offer.name} status={dialog.kind === "declined" ? "declined" : "accepted"} />
        </>
      )}
    </div>
  );
}
