import type { Enums } from "@/types/database";

// What the contact form and POST /api/v1/leads agree on. No Zod here on purpose: the form imports this file,
// and keeping the schema (validation.ts, server-only) out of it keeps Zod out of the browser bundle.

/** Length limits — form `maxLength` and server checks. Mirrored by CHECK constraints on the leads table. */
export const LEAD_LIMITS = { name: 120, email: 254, company: 160, industry: 80, country: 80, message: 5000 } as const;

/** Industries the discovery form offers. Stored as the label; the column stays plain text. */
export const INDUSTRIES = [
  "Accounting and finance",
  "Construction",
  "Consulting",
  "Education",
  "Healthcare",
  "Hospitality",
  "Legal",
  "Marketing",
  "Real estate",
  "Retail",
  "Technology",
  "Travel",
  "Other",
] as const;

/** Exact JSON body of POST /api/v1/leads. */
export type LeadPayload = {
  name: string;
  email: string;
  company: string;
  industry: string;
  country: string;
  package: string;
  message: string;
  meetingDate: string;
  meetingTime: string;
  /** Honeypot — people leave it empty. */
  website: string;
  turnstileToken: string;
};

/** Form inputs that can show a field error (matches the input `name`s). */
export type LeadField = "name" | "email" | "company" | "industry" | "country" | "message" | "package" | "meetingDate" | "meetingTime";

/** Fields the profile editor can send back. */
export type LeadEditField = LeadField | keyof LeadProfileDetails;

/** `data` of a successful POST /api/v1/leads. Nothing about the stored lead is exposed. */
export type LeadCreated = { ok: true };

// Admin system --------------------------------------------------------------------------------------------

export type LeadStatus = Enums<"lead_status">;

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  closed: "Closed",
};

export const LEAD_STATUSES = Object.keys(LEAD_STATUS_LABELS) as LeadStatus[];

/** Lead-list tabs. A junk lead is one that was closed. */
export const LEAD_VIEWS = {
  contacted: "Contacted",
  converted: "Converted Leads",
  closed: "Junk Leads",
} as const satisfies Partial<Record<LeadStatus, string>>;

export type LeadView = keyof typeof LEAD_VIEWS;

/** Statuses an admin sets by hand. "Converted" is set only by converting the lead into a client. */
export const TRIAGE_STATUSES = ["new", "contacted", "qualified", "closed"] as const satisfies readonly LeadStatus[];
export type TriageStatus = (typeof TRIAGE_STATUSES)[number];

/**
 * Where a lead can go next by hand. Open leads move between contacted, qualified and closed; a closed lead
 * can be reopened; a converted lead is final (its client already exists).
 */
export function nextStatuses(from: LeadStatus): TriageStatus[] {
  if (from === "converted") return [];
  if (from === "closed") return ["new"];
  return (["contacted", "qualified", "closed"] as const).filter((to) => to !== from);
}

/** A lead can become a client until it is converted or closed. */
export const isConvertible = (status: LeadStatus) => status !== "converted" && status !== "closed";

/** Sections of a lead's profile. Overview is the default; a tampered `?tab=` falls back to it. */
export const LEAD_PROFILE_TABS = { overview: "Overview", timeline: "Timeline" } as const;
export type LeadProfileTab = keyof typeof LEAD_PROFILE_TABS;

export function leadProfileTab(value: string | string[] | undefined): LeadProfileTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "timeline" ? "timeline" : "overview";
}

/** One row of the admin lead list — only what the screen shows. */
export type LeadSummary = {
  id: string;
  fullName: string;
  email: string;
  companyName: string | null;
  packageCode: string | null;
  status: LeadStatus;
  /** Name of the assigned closer, when `closer_id` points at a profile this admin can read. */
  closerName: string | null;
  createdAt: string;
};

/** A page of leads, newest first. */
export type LeadPage = { leads: LeadSummary[]; total: number; page: number; pageCount: number };

/** Timeline text. Mirrored by the check on lead_events.body. */
export const LEAD_EVENT_LIMIT = 2000;

export const LEAD_EVENT_LABELS = {
  call: "Call summary",
  qualification: "Qualification",
  conversion: "Conversion",
  junk: "Junked",
  note: "Note",
  remark: "Remark",
} as const;

export type LeadEventKind = keyof typeof LEAD_EVENT_LABELS;

/** Kinds an admin writes without also creating a client. Conversion goes through convert. */
export const TIMELINE_KINDS = ["call", "qualification", "junk", "note", "remark"] as const satisfies readonly LeadEventKind[];

/** The one pipeline button for a lead that is still being worked. Convert is its own dialog. */
export const PIPELINE_STEP = {
  new: { kind: "call", label: "Mark as Contacted", title: "Mark as contacted", prompt: "Call summary" },
  contacted: { kind: "qualification", label: "Mark as Qualified", title: "Mark as qualified", prompt: "Qualification details" },
} as const satisfies Partial<Record<LeadStatus, { kind: LeadEventKind; label: string; title: string; prompt: string }>>;

export type LeadEvent = {
  id: string;
  kind: LeadEventKind;
  body: string;
  authorName: string;
  createdAt: string;
  /** File saved with a call summary or a note, when one was attached. */
  attachmentName: string | null;
  attachmentType: string | null;
};

/** Dropdowns on the lead profile. Stored as the label. */
export const LEAD_SOURCES = ["Discovery form", "Referral", "Website", "Social media", "Event", "Other"] as const;
export const CONTACT_METHODS = ["Email", "Phone", "Either"] as const;
export const CONTACT_TIMES = ["Morning", "Afternoon", "Evening"] as const;
export const MARKETING_CONSENT = ["Yes", "No"] as const;
export const BUDGET_RANGES = ["Not sure yet", "Exploring options", "Ready for a package", "Needs a custom quote"] as const;
export const HIRING_TIMELINES = ["As soon as possible", "This month", "In 1 to 3 months", "In 3 to 6 months", "Not sure yet"] as const;
export const PRIORITIES = ["High", "Medium", "Low"] as const;
export const YEARS_IN_SERVICE = ["Under 1 year", "1 to 3 years", "3 to 5 years", "5 to 10 years", "10 years or more"] as const;
export const STAFF_COUNTS = ["Just me", "2 to 10", "11 to 50", "51 to 200", "More than 200"] as const;

/** Free-text profile fields. Mirrored by the size check on leads.profile. */
export const LEAD_PROFILE_LIMITS = { jobTitle: 80, phone: 40, street: 160, city: 80, state: 80, zip: 20, decisionMaker: 120, droppedReason: 200 } as const;

export type LeadProfileDetails = {
  jobTitle: string;
  phone: string;
  source: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  yearsInService: string;
  staffCount: string;
  droppedReason: string;
  budget: string;
  hiringTimeline: string;
  decisionMaker: string;
  priority: string;
  contactMethod: string;
  bestTime: string;
  consent: string;
};

export const emptyLeadProfile = (): LeadProfileDetails => ({
  jobTitle: "",
  phone: "",
  source: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  yearsInService: "",
  staffCount: "",
  droppedReason: "",
  budget: "",
  hiringTimeline: "",
  decisionMaker: "",
  priority: "",
  contactMethod: "",
  bestTime: "",
  consent: "",
});

const PROFILE_COLUMNS = {
  jobTitle: "job_title",
  phone: "phone",
  source: "source",
  street: "street",
  city: "city",
  state: "state",
  zip: "zip",
  yearsInService: "years_in_service",
  staffCount: "staff_count",
  droppedReason: "dropped_reason",
  budget: "budget",
  hiringTimeline: "hiring_timeline",
  decisionMaker: "decision_maker",
  priority: "priority",
  contactMethod: "contact_method",
  bestTime: "best_time",
  consent: "consent",
} as const satisfies Record<keyof LeadProfileDetails, string>;

/** Reads the stored profile. A missing or unexpected value becomes empty fields, never a crash. */
export function leadProfileFrom(value: unknown): LeadProfileDetails {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const profile = emptyLeadProfile();
  for (const key of Object.keys(PROFILE_COLUMNS) as (keyof LeadProfileDetails)[]) {
    const stored = record[PROFILE_COLUMNS[key]];
    if (typeof stored === "string") profile[key] = stored;
  }
  return profile;
}

/** The jsonb written to leads.profile. */
export function leadProfileToJson(profile: LeadProfileDetails): Record<string, string> {
  return Object.fromEntries((Object.keys(PROFILE_COLUMNS) as (keyof LeadProfileDetails)[]).map((key) => [PROFILE_COLUMNS[key], profile[key]]));
}

/** One lead on its own admin page: the summary plus the visitor's message. */
export type LeadDetail = LeadSummary & {
  closerId: string | null;
  message: string;
  industry: string | null;
  country: string | null;
  updatedAt: string;
  /** Set while the pipeline buttons are paused. */
  disabledAt: string | null;
  profile: LeadProfileDetails;
};

export type LeadStatusField = "status";

/** The time zones a package can be staffed in. Mirrored by the check on clients.timezone. */
export const PACKAGE_TIMEZONES = [
  { value: "America/Los_Angeles", label: "Pacific — Los Angeles" },
  { value: "America/Denver", label: "Mountain — Denver" },
  { value: "America/Chicago", label: "Central — Chicago" },
  { value: "America/New_York", label: "Eastern — New York" },
  { value: "Europe/London", label: "United Kingdom — London" },
  { value: "Europe/Paris", label: "Central Europe — Paris" },
  { value: "Asia/Dubai", label: "Gulf — Dubai" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Manila", label: "Philippines — Manila" },
  { value: "Australia/Sydney", label: "Australia — Sydney" },
  { value: "Pacific/Auckland", label: "New Zealand — Auckland" },
] as const;

/** Limits for "Convert to client" — mirrored by CHECK constraints on clients. */
export const CONVERT_LIMITS = { companyName: 160, contactName: 120, contactPhone: 40 } as const;

export type ConvertField = "companyName" | "contactName" | "contactPhone";
