import type { Enums } from "@/types/database";

// Shared by the admin pages and the server. No Zod: components import this file.

export type ClientStatus = Enums<"client_status">;

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  pending: "Pending",
  active: "Active",
  inactive: "Inactive",
};

/** One row of the admin client list — only what the screen shows. */
export type ClientSummary = {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  status: ClientStatus;
  /** Set when an admin hides the client. The list then shows Disabled instead of the onboarding status. */
  disabledAt: string | null;
  /** Who created the record (a Closer, or an admin converting a lead). */
  createdBy: string;
  createdAt: string;
};

/** A client a Closer adds by hand: who they are and the agreed package. Limits mirror the clients CHECKs. */
export const NEW_CLIENT_LIMITS = { companyName: 160, contactName: 120, contactEmail: 254, contactPhone: 40 } as const;
export type NewClientField = "companyName" | "contactName" | "contactEmail" | "contactPhone" | "package" | "hoursPerWeek" | "termMonths" | "startsOn" | "timezone";

/** Billing details the client gives on the onboarding form. Mirrored by the size check on clients.billing. */
export const CLIENT_BILLING_LIMITS = { name: 160, email: 254, street: 160, city: 80, state: 80, zip: 20, country: 80, taxId: 40 } as const;

export type ClientBilling = { name: string; email: string; street: string; city: string; state: string; zip: string; country: string; taxId: string };

/** The onboarding form's inputs, keyed by field name. Billing fields carry a `billing` prefix. */
export type OnboardingField =
  | "contactName"
  | "contactPhone"
  | "jobTitle"
  | "industry"
  | "website"
  | "staffCount"
  | "about"
  | "street"
  | "city"
  | "state"
  | "zip"
  | "country"
  | "billingName"
  | "billingEmail"
  | "billingStreet"
  | "billingCity"
  | "billingState"
  | "billingZip"
  | "billingCountry"
  | "billingTaxId"
  | "consent";

/** What the browser posts to /api/v1/onboarding-submissions: the token from the URL plus every field as typed. */
export type OnboardingPayload = { token: string; consent: boolean } & Record<Exclude<OnboardingField, "consent">, string>;
export type OnboardingSubmitted = { ok: true };

/** What the public onboarding page shows: who it's for and the agreed package (read-only). */
export type OnboardingInvitation = {
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
  expiresAt: string;
};

/** Where the onboarding form stands, from the latest link and the client record. */
export type OnboardingState = "not_sent" | "sent" | "expired" | "withdrawn" | "submitted";

export const ONBOARDING_STATE_LABELS: Record<OnboardingState, string> = {
  not_sent: "Not sent",
  sent: "Sent",
  expired: "Expired",
  withdrawn: "Withdrawn",
  submitted: "Submitted",
};

/** The latest link's dates, as the Closer and admins may read them (never the token or its hash). */
export type OnboardingLink = { createdAt: string; expiresAt: string; submittedAt: string | null; revokedAt: string | null };

export type OnboardingStatus = { state: OnboardingState; link: OnboardingLink | null; submittedAt: string | null; emailedAt: string | null };

/** A submitted form wins; otherwise the latest link decides. */
export function onboardingState(link: OnboardingLink | null, submittedAt: string | null, now = new Date()): OnboardingState {
  if (submittedAt) return "submitted";
  if (!link) return "not_sent";
  if (link.submittedAt) return "submitted";
  if (link.revokedAt) return "withdrawn";
  return new Date(link.expiresAt) <= now ? "expired" : "sent";
}

/** What sending returns: the link, shown once so it can be copied, and whether the email went out. */
export type OnboardingSendResult = { ok: true; link: string; expiresAt: string; emailed: boolean } | { ok: false; message: string };

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

/** Company details are in once we know the business, where it is, and what they need. */
export function companyDetailsComplete(business: ClientBusiness) {
  return filled(business.industry) && filled(business.country) && filled(business.city) && filled(business.about);
}

export const CLIENT_REGISTRATION_STEPS = [
  { id: "registration", label: "Registration" },
  { id: "company", label: "Company Details" },
  { id: "consent", label: "Consent" },
  { id: "payment", label: "Payment" },
  { id: "completed", label: "Completed" },
] as const;

export type ClientRegistrationStep = {
  id: (typeof CLIENT_REGISTRATION_STEPS)[number]["id"];
  label: string;
  done: boolean;
  current: boolean;
};

/** Where activation stands, from the client record and its payments. */
export type ClientProgress = { submitted: boolean; consented: boolean; paid: boolean; active: boolean };

export function progressOf(
  client: { status: ClientStatus; onboardingSubmittedAt: string | null; consentedAt: string | null },
  payments: readonly { status: string }[],
): ClientProgress {
  return {
    submitted: client.onboardingSubmittedAt !== null,
    consented: client.consentedAt !== null,
    paid: payments.some((payment) => payment.status === "paid"),
    active: client.status === "active",
  };
}

/**
 * Registration is done when the client exists. Company details are done when the details are in (or the client
 * sent the onboarding form); consent, payment and completion follow the form, a recorded payment and activation.
 */
export function clientRegistrationSteps(
  business: ClientBusiness,
  progress: ClientProgress = { submitted: false, consented: false, paid: false, active: false },
): ClientRegistrationStep[] {
  const company = progress.submitted || companyDetailsComplete(business);
  const flags = [true, company, progress.consented, progress.paid, progress.active];
  const open = flags.findIndex((done) => !done);
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
  onboardingSubmittedAt: string | null;
  consentedAt: string | null;
  activatedAt: string | null;
};

/** A client as their assigned VA sees them: who to work with and when, nothing about billing or onboarding. */
export type AssignedClient = {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  timezone: string | null;
  hoursPerWeek: number | null;
  startedAt: string;
};
