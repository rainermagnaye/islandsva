import "server-only";
import { site } from "@/content/site";
import { sendPlainEmail } from "@/lib/email";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

/**
 * The onboarding form link, to the client's contact email. Returns false when it doesn't go out; the link already
 * exists, so the Closer can still copy it.
 */
export async function sendOnboardingEmail(message: { to: string; contactName: string; companyName: string; link: string; expiresAt: string }) {
  return sendPlainEmail("Onboarding email", {
    to: message.to,
    subject: `Your ${site.name} onboarding form`,
    text: [
      `Hi ${message.contactName},`,
      "",
      `Thanks for choosing ${site.name}. To set up ${message.companyName}, please fill in your onboarding form:`,
      "",
      message.link,
      "",
      `It takes a few minutes. The link works once and expires on ${day.format(new Date(message.expiresAt))}.`,
      `If it has expired, reply to your contact at ${site.name} and we'll send a new one.`,
      "",
      `— The ${site.name} team`,
    ].join("\n"),
  });
}

/** Tells the client's Closer that the onboarding form is in. No client data beyond the company name. */
export async function sendOnboardingSubmittedEmail(message: { to: string; name: string; companyName: string; profileUrl: string }) {
  return sendPlainEmail("Onboarding notice", {
    to: message.to,
    subject: `${message.companyName} sent their onboarding form`,
    text: [`Hi ${message.name || "there"},`, "", `${message.companyName} has filled in their onboarding form. Check the details and record their payment:`, "", message.profileUrl].join("\n"),
  });
}

/** The client's account email after activation: a single-use link to choose a password. */
export async function sendAccountEmail(message: { to: string; contactName: string; companyName: string; link: string }) {
  return sendPlainEmail("Account email", {
    to: message.to,
    subject: `Your ${site.name} account is ready`,
    text: [
      `Hi ${message.contactName},`,
      "",
      `${message.companyName} is all set up with ${site.name}. Choose a password to open your dashboard:`,
      "",
      message.link,
      "",
      "The link works once and expires in 24 hours. If it has expired, ask your Islands VA contact to send a new one.",
      "",
      `— The ${site.name} team`,
    ].join("\n"),
  });
}
