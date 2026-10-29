"use client";

import { Fragment, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TagChip } from "@/components/ui/tag-chip";
import { BookDemoForm, type BookableSlot } from "@/features/demos/components/book-demo-form";
import { decideShortlist } from "../actions";
import { SKILL_TONES, type OfferView } from "./offer-card";

/** Pick a time with one offered VA. Booking stays on VA Match, and the offer then shows the request. */
export function RequestDemoDialog({
  open,
  onClose,
  name,
  slots,
  timeZone,
  today,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  slots: readonly BookableSlot[];
  timeZone: string;
  today: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Request a demo with ${name}`}
      description={`A 30-minute call. Times are in your time zone; ${name} confirms the request and you'll get an email.`}
      size="wide"
    >
      {open &&
        (slots.length > 0 ? (
          <BookDemoForm slots={slots} timeZone={timeZone} today={today} stay onBooked={onClose} />
        ) : (
          <EmptyState compact headingLevel={3} title={`${name} has no open times right now`} description="VAs add new times every week. Please check back soon, or reply to any email from your Islands VA contact." />
        ))}
    </Modal>
  );
}

/** Confirms adding (accepting) or declining one offer. Adding creates the assignment. */
export function DecideDialog({ open, onClose, offerId, name, status }: { open: boolean; onClose: () => void; offerId: string; name: string; status: "accepted" | "declined" }) {
  const adding = status === "accepted";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={adding ? `Add ${name} as your assistant?` : `Decline ${name}?`}
      description={
        adding
          ? `${name} joins My assistants right away and you can start adding tasks. Your other offers stay open.`
          : "We'll take them off your shortlist. Your Islands VA contact can offer someone else."
      }
      role="alertdialog"
      footer={
        <Form
          aria-label={adding ? `Add ${name}` : `Decline ${name}`}
          onSubmit={async (formData) => {
            const result = await decideShortlist(formData);
            if (result.ok) onClose();
            return result;
          }}
        >
          {({ pending }) => (
            <>
              <input type="hidden" name="shortlistId" value={offerId} />
              <input type="hidden" name="status" value={status} />
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                  {adding ? "Not yet" : "Keep on shortlist"}
                </Button>
                <Button type="submit" variant={adding ? "primary" : "secondary"} iconLeft={adding ? "plus" : undefined} loading={pending}>
                  {pending ? "Saving" : adding ? "Add as assistant" : "Decline"}
                </Button>
              </div>
            </>
          )}
        </Form>
      }
    />
  );
}

/** The VA's work profile, with the next step for this offer. Personal details are never part of it. */
export function ProfileDialog({
  open,
  onClose,
  offer,
  direct,
  blocked,
  onRequest,
  onDecide,
}: {
  open: boolean;
  onClose: () => void;
  offer: OfferView;
  direct: boolean;
  blocked: boolean;
  onRequest: () => void;
  onDecide: (status: "accepted" | "declined") => void;
}) {
  const profile = offer.profile;
  const decide = direct || offer.stage === "met";
  const facts: { label: string; value: ReactNode }[] = [
    { label: "Works", value: offer.hours?.manila ?? "Not set yet" },
    ...(offer.hours?.yours ? [{ label: "For you", value: offer.hours.yours }] : []),
    { label: "Languages", value: profile?.languages ?? "Not listed" },
    { label: "Education", value: profile?.education ?? "Not listed" },
    ...(profile?.certifications ? [{ label: "Certifications", value: profile.certifications }] : []),
    { label: "Offered", value: offer.offered },
  ];

  return (
    <Modal open={open} onClose={onClose} title={offer.name} description={profile?.headline ?? "Virtual assistant"} size="wide">
      <div className="grid gap-6">
        {profile?.responsibilities && <p className="m-0 whitespace-pre-line">{profile.responsibilities}</p>}
        {profile && profile.skills.length > 0 && (
          <ul aria-label="Skills" className="m-0 flex list-none flex-wrap gap-2 p-0">
            {profile.skills.map((skill, index) => (
              <li key={skill}>
                <TagChip tone={SKILL_TONES[index % SKILL_TONES.length]} size="sm">
                  {skill}
                </TagChip>
              </li>
            ))}
          </ul>
        )}
        <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 type-body-sm">
          {facts.map((fact) => (
            <Fragment key={fact.label}>
              <dt className="font-semibold text-ink-muted">{fact.label}</dt>
              <dd className="m-0">{fact.value}</dd>
            </Fragment>
          ))}
        </dl>
        {profile && profile.employers.length > 0 && (
          <section aria-labelledby="profile-experience" className="grid gap-2">
            <h3 id="profile-experience" className="m-0 type-label">
              Experience
            </h3>
            <ul className="m-0 grid list-none gap-2 p-0">
              {profile.employers.map((job) => (
                <li key={`${job.position}-${job.company}-${job.duration}`} className="grid type-body-sm">
                  <strong>{[job.position, job.company].filter(Boolean).join(" · ")}</strong>
                  {job.duration && <span className="text-ink-muted">{job.duration}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {profile?.achievements && (
          <section aria-labelledby="profile-achievement" className="grid gap-2">
            <h3 id="profile-achievement" className="m-0 type-label">
              Highlights
            </h3>
            <p className="m-0 whitespace-pre-line type-body-sm">{profile.achievements}</p>
          </section>
        )}
        <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          {!decide && offer.stage === "new" && (
            <Button type="button" iconLeft="calendar" disabled={blocked} onClick={onRequest}>
              Request demo
            </Button>
          )}
          {decide && (
            <Button type="button" iconLeft="plus" onClick={() => onDecide("accepted")}>
              Add as assistant
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
