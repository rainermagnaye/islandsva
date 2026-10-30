import type { ReactNode } from "react";
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

/** The registration link's agreement step: the typed name, like client_agreements.signer_name. */
export const SIGNER_NAME_LIMIT = 120;
export type AgreementAcceptanceField = "signerName" | "accept";
export type PaymentProofStepField = "proof";

/** Sections an admin can mark while the packet is in review. */
export const CLIENT_REVIEW_SECTIONS = ["basic", "address", "contacts", "package", "consent", "payment"] as const;

export type ClientReviewSection = (typeof CLIENT_REVIEW_SECTIONS)[number];

/** Recording the payment received when a registration is confirmed (the sales summary totals these). */
export const PAYMENT_RECEIVED_LIMITS = { reference: 200, maxAmountCents: 100_000_000 } as const;

export type PaymentReceivedField = "amount" | "fee" | "paidOn" | "reference";

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

/** A message between a client and one assigned VA. */
export const VA_MESSAGE_LIMIT = 2000;
export type VaMessageField = "body";

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

/** The admin review's server-rendered parts: the agreement evidence, the payment checklist, and whether approval is open. */
export type ClientReviewParts = { evidence: ReactNode; record: ReactNode; checklist: ReactNode; approvable: boolean };

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
