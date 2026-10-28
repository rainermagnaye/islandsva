import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { todayIn, wallClockIn } from "@/components/ui/date-math";
import type { Tone } from "@/components/ui/tone";
import { clientVaHref } from "@/content/routes";
import { listActiveAssignments } from "@/features/clients/assignment-dal";
import { getClient, getOwnClientId } from "@/features/clients/dal";
import { listClientDemos, listOpenSlots } from "@/features/demos/booking-dal";
import { bookableTimes, demoState, formatInZone, safeTimeZone } from "@/features/demos/contract";
import { MatchList, type OfferView } from "@/features/matching/components/match-list";
import { listOfferedProfiles, listShortlist } from "@/features/matching/dal";
import { hoursSummary } from "@/features/matching/profile";
import { matchStage, openDemo, type DemoForMatch } from "@/features/matching/stage";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "VA Match" };

const TONES: readonly Tone[] = ["lagoon", "ocean", "sand", "coral"];

export default function ClientMatchPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ClientMatch />
    </Suspense>
  );
}

async function ClientMatch() {
  const user = await requireRole(["client"]);
  // RLS: a client reads only their own record, offers, assignments, bookings and the slots they may book.
  const clientId = await getOwnClientId(user.id);
  const client = clientId ? await getClient(clientId) : null;
  if (!client) {
    return (
      <Workspace title="VA Match">
        <ComingSoon title="Your account is being set up">Your Islands VA contact is finishing your setup. Check back soon, or reply to their email.</ComingSoon>
      </Workspace>
    );
  }

  const [offers, assignments, bookings, profiles] = await Promise.all([listShortlist(client.id), listActiveAssignments(client.id), listClientDemos(client.id), listOfferedProfiles()]);
  const now = new Date();
  const zone = safeTimeZone(client.timezone);
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: zone });
  const demos: DemoForMatch[] = bookings.map((booking) => ({ id: booking.id, vaId: booking.vaId, state: demoState(booking, now), startsAt: booking.startsAt, rejectReason: booking.rejectReason }));
  // The database books demos only for a client without a VA (IVA16), and one at a time (IVA17).
  const direct = assignments.length > 0;
  const busy = openDemo(demos);

  const open = offers.filter((offer) => offer.status === "offered");
  const slots = direct ? open.map(() => []) : await Promise.all(open.map((offer) => listOpenSlots(offer.vaId)));
  const views: OfferView[] = open.map((offer, index) => {
    const stage = matchStage(offer, demos);
    const demo = stage.kind === "new" ? null : stage.demo;
    const last = stage.kind === "new" ? stage.last : null;
    const found = profiles.find((profile) => profile.vaId === offer.vaId);
    return {
      id: offer.id,
      name: offer.vaFirstName,
      tone: TONES[index % TONES.length],
      offered: day.format(new Date(offer.createdAt)),
      stage: stage.kind,
      demoWhen: demo ? formatInZone(demo.startsAt, zone) : null,
      bookingId: demo && stage.kind !== "met" ? demo.id : null,
      notice:
        last?.state === "rejected"
          ? `${offer.vaFirstName} couldn't take your last time${last.rejectReason ? `: ${last.rejectReason}` : "."} Please pick another.`
          : last?.state === "expired"
            ? "Your last request wasn't answered in time. Please pick another."
            : null,
      slots: bookableTimes(slots[index]).map((slot) => ({ slotId: slot.slotId, start: wallClockIn(slot.startsAt, zone) })),
      profile: found
        ? {
            headline: found.headline,
            skills: found.skills,
            languages: found.languages,
            education: found.education,
            certifications: found.certifications,
            employers: found.employers,
            responsibilities: found.responsibilities,
            achievements: found.achievements,
          }
        : null,
      hours: found ? hoursSummary(found.hours, zone, now) : null,
    };
  });
  const busyWith = busy ? (open.find((offer) => offer.vaId === busy.vaId)?.vaFirstName ?? bookings.find((booking) => booking.id === busy.id)?.vaName ?? "your VA") : null;

  return (
    <Workspace title="VA Match">
      <MatchList
        offers={views}
        team={assignments.map((assignment, index) => ({ id: assignment.vaId, name: assignment.vaName.trim().split(/\s+/)[0] || assignment.vaName, tone: TONES[index % TONES.length], href: clientVaHref(assignment.vaId) }))}
        declined={offers.filter((offer) => offer.status === "declined").map((offer) => ({ id: offer.id, name: offer.vaFirstName, offered: day.format(new Date(offer.createdAt)) }))}
        timeZone={zone}
        today={todayIn(zone)}
        direct={direct}
        busyWith={busyWith}
      />
    </Workspace>
  );
}
