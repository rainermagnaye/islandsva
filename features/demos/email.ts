import "server-only";
import { appRoutes } from "@/content/routes";
import { site } from "@/content/site";
import { sendPlainEmail } from "@/lib/email";
import { VA_TIME_ZONE, formatInZone } from "./contract";

// Demo emails, plain text, about three per demo: the request and a cancellation to the VA, the decision to the
// client. Each shows the time in the reader's zone (and the other side's, so nobody converts by hand).

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

/** A client asked for a demo: tells the VA, with the link to confirm or decline. */
export function sendDemoRequestEmail(demo: { vaEmail: string; vaName: string; companyName: string; startsAt: string; clientTimezone: string | null; note: string | null }) {
  return sendPlainEmail("Demo request email", {
    to: demo.vaEmail,
    subject: `Demo request from ${demo.companyName}`,
    text: [
      `Hi ${firstName(demo.vaName)},`,
      "",
      `${demo.companyName} would like a 30-minute demo call:`,
      `${formatInZone(demo.startsAt, VA_TIME_ZONE)} (your time)`,
      `${formatInZone(demo.startsAt, demo.clientTimezone)} (their time)`,
      ...(demo.note ? ["", "Their note:", demo.note] : []),
      "",
      "Confirm or decline it in your dashboard. If it isn't answered before it starts, it expires.",
      new URL(appRoutes.va, site.url).toString(),
      "",
      `— The ${site.name} team`,
    ].join("\n"),
  });
}

/** The client cancelled: tells the VA. */
export function sendDemoCancelledEmail(demo: { vaEmail: string; vaName: string; companyName: string; startsAt: string }) {
  return sendPlainEmail("Demo cancelled email", {
    to: demo.vaEmail,
    subject: `${demo.companyName} cancelled their demo`,
    text: [
      `Hi ${firstName(demo.vaName)},`,
      "",
      `${demo.companyName} cancelled their demo call on ${formatInZone(demo.startsAt, VA_TIME_ZONE)} (your time). The slot is open again.`,
      "",
      `— The ${site.name} team`,
    ].join("\n"),
  });
}

/** The VA confirmed or declined: tells the client. */
export function sendDemoDecisionEmail(demo: {
  clientEmail: string;
  contactName: string;
  companyName: string;
  startsAt: string;
  clientTimezone: string | null;
  vaName: string;
  confirmed: boolean;
  reason: string | null;
}) {
  const when = formatInZone(demo.startsAt, demo.clientTimezone);
  const dashboard = new URL(appRoutes.client, site.url).toString();
  return sendPlainEmail("Demo decision email", {
    to: demo.clientEmail,
    subject: demo.confirmed ? `Your demo call is confirmed: ${when}` : "Please pick another time for your demo call",
    text: [
      `Hi ${firstName(demo.contactName)},`,
      "",
      ...(demo.confirmed
        ? [`${demo.vaName} confirmed your 30-minute demo call for ${demo.companyName} on ${when}.`, "", "You can cancel it from your dashboard before it starts:"]
        : [
            `${demo.vaName} can't take the demo call on ${when}.`,
            ...(demo.reason ? ["", demo.reason] : []),
            "",
            "Please pick another time from your dashboard:",
          ]),
      dashboard,
      "",
      `— The ${site.name} team`,
    ].join("\n"),
  });
}
