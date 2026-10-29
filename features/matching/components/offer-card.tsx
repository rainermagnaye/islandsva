"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TagChip } from "@/components/ui/tag-chip";
import type { Tone } from "@/components/ui/tone";
import type { BookableSlot } from "@/features/demos/components/book-demo-form";
import { CancelDemoButton } from "@/features/demos/components/cancel-demo-button";
import { cx } from "@/lib/cx";
import type { OfferedProfile } from "../profile";
import type { MatchStage } from "../stage";

export type OfferView = {
  id: string;
  name: string;
  tone: Tone;
  offered: string;
  stage: MatchStage["kind"];
  /** The demo's time in the client's zone, when there is one to show. */
  demoWhen: string | null;
  bookingId: string | null;
  /** What happened to the last request, when it didn't go ahead. */
  notice: string | null;
  slots: readonly BookableSlot[];
  profile: Omit<OfferedProfile, "hours" | "vaId" | "firstName"> | null;
  hours: { manila: string; yours: string | null } | null;
};

export const SKILL_TONES: readonly Tone[] = ["lagoon", "ocean", "sand"];

const BADGE: Record<MatchStage["kind"], { label: string; tone: "neutral" | "info" | "success" }> = {
  new: { label: "New", tone: "neutral" },
  requested: { label: "Demo requested", tone: "info" },
  confirmed: { label: "Demo confirmed", tone: "info" },
  met: { label: "Demo done", tone: "success" },
};

/** One offered VA: who they are at a glance, where the demo stands, and the next step. */
export function OfferCard({
  offer,
  direct,
  busyWith,
  onView,
  onRequest,
  onDecide,
}: {
  offer: OfferView;
  direct: boolean;
  busyWith: string | null;
  onView: () => void;
  onRequest: () => void;
  onDecide: (status: "accepted" | "declined") => void;
}) {
  const decide = direct || offer.stage === "met";
  const blocked = !direct && offer.stage === "new" && busyWith !== null;
  const skills = offer.profile?.skills ?? [];
  const shown = skills.slice(0, 3);

  return (
    <li aria-labelledby={`offer-${offer.id}`} className="grid content-start gap-4 rounded-lg border border-border bg-surface-card p-6">
      <div className="flex items-center gap-4">
        <Avatar name={offer.name} tone={offer.tone} size="lg" />
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`offer-${offer.id}`} className="m-0 type-h4">
              {offer.name}
            </h3>
            {!direct && (
              <Badge tone={BADGE[offer.stage].tone} size="sm">
                {BADGE[offer.stage].label}
              </Badge>
            )}
          </div>
          <p className="m-0 type-body-sm text-ink-muted">{offer.profile?.headline ?? "Virtual assistant"}</p>
        </div>
      </div>

      {shown.length > 0 && (
        <ul aria-label="Skills" className="m-0 flex list-none flex-wrap gap-2 p-0">
          {shown.map((skill, index) => (
            <li key={skill}>
              <TagChip tone={SKILL_TONES[index % SKILL_TONES.length]} size="sm">
                {skill}
              </TagChip>
            </li>
          ))}
          {skills.length > shown.length && <li className="self-center type-caption text-ink-muted">+{skills.length - shown.length} more</li>}
        </ul>
      )}

      <p className="m-0 type-body-sm text-ink-muted">{offer.hours ? offer.hours.manila : "Working hours not set yet"}</p>

      {!direct && offer.demoWhen && (
        <div className={cx("flex items-center gap-3 rounded-md p-3", offer.stage === "met" ? "bg-status-success-bg" : "bg-status-info-bg")}>
          <span aria-hidden="true" className={cx("grid size-9 shrink-0 place-items-center rounded-pill bg-surface-card", offer.stage === "met" ? "text-status-success" : "text-status-info")}>
            <Icon name={offer.stage === "met" ? "check-circle" : "clock"} />
          </span>
          <span className="grid min-w-0">
            <strong className="type-body-sm">
              {offer.stage === "requested" ? `Waiting for ${offer.name} to confirm` : offer.stage === "confirmed" ? "Your demo call is booked" : "You met on a demo call"}
            </strong>
            <span className="type-body-sm">{offer.stage === "met" ? `${offer.demoWhen} · Add them, or decline.` : offer.demoWhen}</span>
          </span>
        </div>
      )}
      {!direct && offer.notice && <p className="m-0 type-body-sm text-ink-muted">{offer.notice}</p>}

      <div className="grid gap-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {!decide && offer.stage === "new" && (
            <Button type="button" size="sm" iconLeft="calendar" disabled={blocked} onClick={onRequest}>
              Request demo
            </Button>
          )}
          {decide && (
            <>
              <Button type="button" size="sm" iconLeft="plus" onClick={() => onDecide("accepted")}>
                Add as assistant
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => onDecide("declined")}>
                Decline
              </Button>
            </>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={onView}>
            View profile
          </Button>
        </div>
        {!decide && (offer.stage === "requested" || offer.stage === "confirmed") && offer.bookingId && <CancelDemoButton bookingId={offer.bookingId} />}
        {blocked && <p className="m-0 type-caption text-ink-muted">One demo at a time: finish or cancel your demo with {busyWith} first.</p>}
        <p className="m-0 type-caption text-ink-muted">Offered {offer.offered}</p>
      </div>
    </li>
  );
}
