import type { Enums } from "@/types/database";

// Shared by the admin pages and the server. No Zod: components import this file.

export type ClientStatus = Enums<"client_status">;
export type ClientOnboardingStatus = Enums<"client_onboarding_status">;

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  pending: "Pending",
  active: "Active",
  inactive: "Inactive",
};

/** Packet progress. The account status stays pending until the later password invite. */
export const CLIENT_ONBOARDING_LABELS: Record<ClientOnboardingStatus, string> = {
  ready: "Ready",
  pending_customer: "Pending customer",
  pending_review: "Pending review",
  changes_requested: "Changes requested",
  approved: "Pending activation",
  invite_sent: "Pending activation",
};

const ONBOARDING_TONE = {
  ready: "warning",
  pending_customer: "info",
  pending_review: "warning",
  changes_requested: "danger",
  approved: "warning",
  invite_sent: "warning",
} as const;

/** The badge on the list and the profile. A disabled, inactive or active account wins over the packet. */
export function clientBadge(client: { status: ClientStatus; onboardingStatus: ClientOnboardingStatus; disabledAt: string | null }): {
  label: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  dot: boolean;
} {
  if (client.disabledAt) return { label: "Disabled", tone: "neutral", dot: true };
  if (client.status === "inactive") return { label: "Inactive", tone: "neutral", dot: true };
  if (client.status === "active") return { label: "Active", tone: "success", dot: false };
  return { label: CLIENT_ONBOARDING_LABELS[client.onboardingStatus], tone: ONBOARDING_TONE[client.onboardingStatus], dot: false };
}

/** The public link is open while the account is pending and the packet is still with the customer. */
export function onboardingAccess(client: { status: ClientStatus; onboardingStatus: ClientOnboardingStatus; disabledAt: string | null }) {
  const closed = Boolean(client.disabledAt) || client.status === "inactive";
  const editable = !closed && client.status === "pending" && (client.onboardingStatus === "pending_customer" || client.onboardingStatus === "ready" || client.onboardingStatus === "changes_requested");
  return { closed, editable };
}

/** One row of the admin client list — only what the screen shows. */
export type ClientSummary = {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  status: ClientStatus;
  onboardingStatus: ClientOnboardingStatus;
  /** Set when an admin hides the client. The list then shows Disabled instead of the onboarding status. */
  disabledAt: string | null;
  /** Who created the record (a Closer, or an admin converting a lead). */
  createdBy: string;
  createdAt: string;
};

/** A client a Closer adds by hand: who they are and the agreed package. Limits mirror the clients CHECKs. */
export const NEW_CLIENT_LIMITS = { companyName: 160, contactName: 120, contactEmail: 254, contactPhone: 40 } as const;
export type NewClientField = "companyName" | "contactName" | "contactEmail" | "contactPhone" | "package" | "hoursPerWeek" | "termMonths" | "startsOn" | "timezone";

/** A page of clients, newest first. */
export type ClientPage = { clients: ClientSummary[]; total: number; page: number; pageCount: number };

/** Company-details text. Mirrored by the size check on clients.business. */
export const CLIENT_BUSINESS_LIMITS = {
  industry: 80,
  country: 80,
  website: 200,
  jobTitle: 80,
  street: 160,
  city: 80,
  state: 80,
  zip: 20,
  about: 2000,
} as const;

export type OnboardingField = ClientDetailField | "signature" | "consent";

/** What an admin types to add a client straight onto the list. */
export const CREATE_CLIENT_LIMITS = { companyName: 160, contactName: 120, contactEmail: 254, contactPhone: 40 } as const;

export type CreateClientField = "companyName" | "contactName" | "contactEmail" | "contactPhone";

export type ClientDetailField =
  | "companyName"
  | "contactName"
  | "contactPhone"
  | "industry"
  | "country"
  | "website"
  | "jobTitle"
  | "street"
  | "city"
  | "state"
  | "zip"
  | "staffCount"
  | "about";

export type ClientBusiness = {
  industry: string;
  country: string;
  website: string;
  jobTitle: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  staffCount: string;
  about: string;
};

export const emptyClientBusiness = (): ClientBusiness => ({
  industry: "",
  country: "",
  website: "",
  jobTitle: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  staffCount: "",
  about: "",
});

const BUSINESS_KEYS = Object.keys(emptyClientBusiness()) as (keyof ClientBusiness)[];

/** Reads stored business details. A missing or unexpected value becomes empty fields. */
export function clientBusinessFrom(value: unknown): ClientBusiness {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const business = emptyClientBusiness();
  for (const key of BUSINESS_KEYS) {
    const stored = record[key];
    if (typeof stored === "string") business[key] = stored;
  }
  return business;
}

export function clientBusinessToJson(business: ClientBusiness): Record<string, string> {
  return Object.fromEntries(BUSINESS_KEYS.map((key) => [key, business[key]]));
}

/** What the lead already told us, so company details start filled in. */
export function businessFromEnquiry(source: {
  industry: string | null;
  country: string | null;
  message: string;
  jobTitle: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  staffCount: string;
}): ClientBusiness {
  return {
    ...emptyClientBusiness(),
    industry: source.industry ?? "",
    country: source.country ?? "",
    jobTitle: source.jobTitle,
    street: source.street,
    city: source.city,
    state: source.state,
    zip: source.zip,
    staffCount: source.staffCount,
    about: source.message,
  };
}

const filled = (value: string) => value.trim().length > 0;

export const CLIENT_REGISTRATION_STEPS = [
  { id: "converted", label: "Converted" },
  { id: "registration", label: "Registration" },
  { id: "review", label: "Review" },
  { id: "activation", label: "Activation" },
  { id: "completed", label: "Completed" },
] as const;

/** Sections an admin can mark while the packet is in review. */
export const CLIENT_REVIEW_SECTIONS = ["basic", "address", "contacts", "package", "consent", "payment"] as const;
export type ClientReviewSection = (typeof CLIENT_REVIEW_SECTIONS)[number];
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

/** Sections of a client's profile. Overview is the default; a tampered `?tab=` falls back to it. */
export const CLIENT_PROFILE_TABS = { overview: "Overview", notes: "Notes", consents: "Consents", invoices: "Invoices" } as const;
export type ClientProfileTab = keyof typeof CLIENT_PROFILE_TABS;

export function clientProfileTab(value: string | string[] | undefined): ClientProfileTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "notes" || raw === "consents" || raw === "invoices") return raw;
  return "overview";
}

/** A note on the client profile. The file is optional. */
export const CLIENT_NOTE_LIMIT = 2000;
export type ClientNoteField = "body";

export type ClientNote = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  attachmentName: string | null;
  attachmentType: string | null;
};

/** The client profile: the list row, the agreed package, and the registration progress. */
export type ClientDetail = ClientSummary & {
  contactPhone: string | null;
  packageCode: string | null;
  hoursPerWeek: number | null;
  termMonths: number | null;
  monthlyCents: number | null;
  startsOn: string | null;
  timezone: string | null;
  business: ClientBusiness;
};

/** What the registration link shows. The token stays in the URL, not in this object. */
export type PublicOnboarding = {
  closed: boolean;
  editable: boolean;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  business: ClientBusiness;
  packageCode: string | null;
  hoursPerWeek: number | null;
  termMonths: number | null;
  monthlyCents: number | null;
  startsOn: string | null;
  timezone: string | null;
  consentName: string | null;
  paymentProofName: string | null;
  reviewIssues: ClientReviewSection[];
  reviewNote: string | null;
};

/** The link and the files already on the packet, for the admin profile. */
export type ClientPacketSummary = {
  url: string | null;
  consentName: string | null;
  consentSignedAt: string | null;
  paymentProofName: string | null;
  paymentProofType: string | null;
  reviewIssues: ClientReviewSection[];
  reviewNote: string | null;
};
