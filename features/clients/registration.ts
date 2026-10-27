import { CLIENT_REVIEW_SECTIONS, type ClientBusiness, type ClientOnboardingStatus, type ClientReviewSection, type ClientStatus } from "./contract";

// The registration packet's steps and review sections: pure rules shared by the admin pages, the registration
// link and the server. No Zod: components import this file.

const filled = (value: string) => value.trim().length > 0;

export const CLIENT_REGISTRATION_STEPS = [
  { id: "converted", label: "Converted" },
  { id: "registration", label: "Registration" },
  { id: "review", label: "Review" },
  { id: "activation", label: "Activation" },
  { id: "completed", label: "Completed" },
] as const;

export const CLIENT_REVIEW_SECTION_LABELS: Record<ClientReviewSection, string> = {
  basic: "Basic info",
  address: "Address",
  contacts: "Contacts",
  package: "Package",
  consent: "Consent",
  payment: "Payment",
};

export const CLIENT_REVIEW_NOTE_LIMIT = 500;

/** Accepts a text array, or the `{basic,address}` text Postgres can return for one. */
export function clientReviewSections(value: unknown): ClientReviewSection[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.replace(/^\{|\}$/g, "").split(",") : [];
  return items
    .map((item) => String(item).trim().replace(/^"|"$/g, ""))
    .filter((item): item is ClientReviewSection => (CLIENT_REVIEW_SECTIONS as readonly string[]).includes(item));
}

/** What the customer sees after a registration is sent back. */
export function revisionMessage(issues: readonly ClientReviewSection[], note: string | null) {
  const names = issues.map((id) => CLIENT_REVIEW_SECTION_LABELS[id]);
  const list = names.length === 0 ? "" : names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return [list ? `Please update ${list}.` : "", note?.trim() ?? ""].filter(Boolean).join(" ");
}

/** The packet values a return is allowed to change. Package is shown, never edited. */
export type ClientSectionDraft = {
  companyName: string;
  contactName: string;
  contactPhone: string | null;
  business: ClientBusiness;
  consentName: string | null;
  paymentProofName: string | null;
  reviewIssues: readonly ClientReviewSection[];
};

/**
 * First visit shows every section. A return shows the flagged ones, plus any that are still empty.
 * Package stays with them when it was flagged, and on the first visit so the amount is visible.
 */
export function openClientSections(draft: ClientSectionDraft): ClientReviewSection[] {
  const missing: ClientReviewSection[] = [];
  if (!filled(draft.companyName) || !filled(draft.business.industry) || !filled(draft.business.about)) missing.push("basic");
  if (!filled(draft.business.city) || !filled(draft.business.country)) missing.push("address");
  if (!filled(draft.contactName)) missing.push("contacts");
  if (!draft.consentName?.trim()) missing.push("consent");
  if (!draft.paymentProofName?.trim()) missing.push("payment");
  if (draft.reviewIssues.length === 0) return [...CLIENT_REVIEW_SECTIONS];
  return CLIENT_REVIEW_SECTIONS.filter((section) => draft.reviewIssues.includes(section) || missing.includes(section));
}

/** Keeps stored values for every section the customer was not asked to change. */
export function applyOpenSections<T extends { companyName: string; contactName: string; contactPhone: string | null; consentName: string; business: ClientBusiness }>(
  submitted: T,
  stored: ClientSectionDraft,
  open: readonly ClientReviewSection[],
): T {
  const closed = (section: ClientReviewSection) => !open.includes(section);
  return {
    ...submitted,
    companyName: closed("basic") ? stored.companyName : submitted.companyName,
    contactName: closed("contacts") ? stored.contactName : submitted.contactName,
    contactPhone: closed("contacts") ? stored.contactPhone : submitted.contactPhone,
    consentName: closed("consent") ? stored.consentName?.trim() || submitted.consentName : submitted.consentName,
    business: {
      ...submitted.business,
      industry: closed("basic") ? stored.business.industry : submitted.business.industry,
      website: closed("basic") ? stored.business.website : submitted.business.website,
      staffCount: closed("basic") ? stored.business.staffCount : submitted.business.staffCount,
      about: closed("basic") ? stored.business.about : submitted.business.about,
      jobTitle: closed("contacts") ? stored.business.jobTitle : submitted.business.jobTitle,
      street: closed("address") ? stored.business.street : submitted.business.street,
      city: closed("address") ? stored.business.city : submitted.business.city,
      state: closed("address") ? stored.business.state : submitted.business.state,
      zip: closed("address") ? stored.business.zip : submitted.business.zip,
      country: closed("address") ? stored.business.country : submitted.business.country,
    },
  };
}

export type ClientRegistrationStep = {
  id: (typeof CLIENT_REGISTRATION_STEPS)[number]["id"];
  label: string;
  done: boolean;
  current: boolean;
};

/**
 * Converted is done once the lead is a client. Registration is the one form: company details, consent and payment.
 * It checks when that form is with the team, and opens again when they send it back.
 * Review checks when an admin accepts it. Activation checks when the password invite is sent, and that completes it.
 */
export function clientRegistrationSteps(progress: {
  onboardingStatus: ClientOnboardingStatus;
  accountStatus: ClientStatus;
}): ClientRegistrationStep[] {
  const submitted = progress.accountStatus === "active" || progress.onboardingStatus === "pending_review" || progress.onboardingStatus === "approved" || progress.onboardingStatus === "invite_sent";
  const reviewed = progress.accountStatus === "active" || progress.onboardingStatus === "approved" || progress.onboardingStatus === "invite_sent";
  const activated = progress.accountStatus === "active" || progress.onboardingStatus === "invite_sent";
  const flags = [true, submitted, reviewed, activated, activated];
  const open = flags.findIndex((step) => !step);
  const current = open === -1 ? flags.length - 1 : open;
  return CLIENT_REGISTRATION_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    done: flags[index],
    current: index === current,
  }));
}
