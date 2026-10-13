import { packages } from "@/content/packages";
import { LEAD_STATUS_LABELS, type LeadStatus } from "../contract";

const STATUS_TONE: Record<LeadStatus, string> = {
  new: "text-action-secondary",
  contacted: "text-ink",
  qualified: "text-ink",
  converted: "text-status-success",
  closed: "text-ink-muted",
};

/** A lead's status as coloured text (the colour adds emphasis; the word carries the meaning). */
export function LeadStatusLabel({ status }: { status: LeadStatus }) {
  return <span className={STATUS_TONE[status]}>{LEAD_STATUS_LABELS[status]}</span>;
}

const packageNames = new Map(packages.map((p) => [p.slug, p.name]));

/** The package a visitor picked on the contact form, by name. */
export const packageName = (code: string | null) => (code && packageNames.get(code)) ?? "Not sure yet";
