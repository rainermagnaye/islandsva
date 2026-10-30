import { CLIENT_REVIEW_SECTIONS, type ClientBusiness, type ClientOnboardingStatus, type ClientReviewSection, type ClientStatus } from "./contract";

// The registration packet's steps and review sections: pure rules shared by the admin pages, the registration
// link and the server. No Zod: components import this file.

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

/** A text array, or the `{basic,address}` text Postgres can return for one. */
function textItems(value: unknown) {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.replace(/^\{|\}$/g, "").split(",") : [];
  return items.map((item) => String(item).trim().replace(/^"|"$/g, ""));
}

/** The old form's sections (`agreement` is skipped: that form has no such section). */
export function clientReviewSections(value: unknown): ClientReviewSection[] {
  return textItems(value).filter((item): item is ClientReviewSection => (CLIENT_REVIEW_SECTIONS as readonly string[]).includes(item));
}

/** The registration link's three steps, in order. */
export const REGISTRATION_STEPS = ["details", "agreement", "payment"] as const;

export type RegistrationStep = (typeof REGISTRATION_STEPS)[number];

/** Every stored review section (old names and the new `agreement`) as the step it belongs to. */
const STEP_OF_SECTION: Record<string, RegistrationStep> = {
  basic: "details",
  address: "details",
  contacts: "details",
  package: "agreement",
  consent: "agreement",
  agreement: "agreement",
  payment: "payment",
};

/** Stored review sections, keeping only names the database allows. */
export const registrationIssues = (value: unknown) => textItems(value).filter((item) => Object.hasOwn(STEP_OF_SECTION, item));

export const REGISTRATION_STEP_LABELS: Record<RegistrationStep, string> = { details: "Details", agreement: "Agreement", payment: "Payment proof" };

/** What the customer sees after a return: the steps sent back, in order, then the team's note. */
export function stepRevisionMessage(issues: readonly string[], note: string | null) {
  const steps = REGISTRATION_STEPS.filter((step) => issues.some((issue) => Object.hasOwn(STEP_OF_SECTION, issue) && STEP_OF_SECTION[issue] === step));
  const names = steps.map((step) => REGISTRATION_STEP_LABELS[step].toLowerCase());
  const list = names.length === 0 ? "" : names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return [list ? `Please update your ${list}.` : "", note?.trim() ?? ""].filter(Boolean).join(" ");
}

const within = (value: string | undefined, max: number) => {
  const length = (value ?? "").trim().length;
  return length >= 1 && length <= max;
};

/**
 * The steps still to do, in order — the same rule as private.packet_open_sections (20261029172015): every sent-back
 * section's step, plus any step that isn't complete. Details: company, contact, industry, country, city and about,
 * within the database's limits. Agreement: an acceptance of the current terms, which needs the terms set. Payment:
 * a proof on file. Empty means the packet is ready for review.
 */
export function openRegistrationSteps(state: {
  companyName: string;
  contactName: string;
  business: Pick<ClientBusiness, "industry" | "country" | "city" | "about">;
  reviewIssues: readonly string[];
  agreementCurrent: boolean;
  termsMissing: boolean;
  hasProof: boolean;
}): RegistrationStep[] {
  const open = new Set(state.reviewIssues.filter((issue) => Object.hasOwn(STEP_OF_SECTION, issue)).map((issue) => STEP_OF_SECTION[issue]));
  const { business } = state;
  const detailsDone =
    within(state.companyName, 160) &&
    within(state.contactName, 120) &&
    within(business.industry, 80) &&
    within(business.country, 80) &&
    within(business.city, 80) &&
    within(business.about, 2000);
  if (!detailsDone) open.add("details");
  if (state.termsMissing || !state.agreementCurrent) open.add("agreement");
  if (!state.hasProof) open.add("payment");
  return REGISTRATION_STEPS.filter((step) => open.has(step));
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

export type RegistrationView = "closed" | "steps" | "receipt" | "complete" | "processing";

/**
 * What the registration link shows. The customer's details appear (read-only) only while the team reviews them;
 * once approved, invited or active the link holds no client data and points to sign-in instead.
 */
export function registrationView(state: {
  accountStatus: ClientStatus;
  onboardingStatus: ClientOnboardingStatus;
  disabledAt: string | null;
  openSteps: number;
}): RegistrationView {
  if (state.disabledAt || state.accountStatus === "inactive") return "closed";
  if (state.accountStatus === "active" || state.onboardingStatus === "approved" || state.onboardingStatus === "invite_sent") return "complete";
  if (state.onboardingStatus === "pending_review") return "receipt";
  // With the customer: the next open step. None open is the moment between the last save and the move to review.
  return state.openSteps > 0 ? "steps" : "processing";
}
