import type { Enums } from "@/types/database";

// What the contact form and POST /api/v1/leads agree on. No Zod here on purpose: the form imports this file,
// and keeping the schema (validation.ts, server-only) out of it keeps Zod out of the browser bundle.

/** Length limits — form `maxLength` and server checks. Mirrored by CHECK constraints on the leads table. */
export const LEAD_LIMITS = { name: 120, email: 254, company: 160, message: 5000 } as const;

/** Exact JSON body of POST /api/v1/leads. */
export type LeadPayload = {
  name: string;
  email: string;
  company: string;
  package: string;
  message: string;
  /** Honeypot — people leave it empty. */
  website: string;
  turnstileToken: string;
};

/** Form inputs that can show a field error (matches the input `name`s). */
export type LeadField = "name" | "email" | "company" | "message" | "package";
export type LeadFieldErrors = Partial<Record<LeadField, string>>;

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

/** A lead can become a client until it is converted or closed. */
export const isConvertible = (status: LeadStatus) => status !== "converted" && status !== "closed";

/** One row of the admin lead list — only what the screen shows. */
export type LeadSummary = {
  id: string;
  fullName: string;
  email: string;
  companyName: string | null;
  packageCode: string | null;
  status: LeadStatus;
  createdAt: string;
};

/** A page of leads, newest first. */
export type LeadPage = { leads: LeadSummary[]; total: number; page: number; pageCount: number };

/** Limits for "Convert to client" — mirrored by CHECK constraints on clients. */
export const CONVERT_LIMITS = { companyName: 160, contactName: 120, contactPhone: 40 } as const;

export type ConvertField = "companyName" | "contactName" | "contactPhone";
