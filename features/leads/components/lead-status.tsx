import { Badge, type BadgeTone } from "@/components/ui/badge";
import { packages } from "@/content/packages";
import { LEAD_STATUS_LABELS, type LeadStatus } from "../contract";

// Tones follow the design system's status rules: info = waiting on us, warning = a decision is due
// (qualified, ready to convert), success = done, neutral = no action needed.
const TONES: Record<LeadStatus, BadgeTone> = {
  new: "info",
  contacted: "neutral",
  qualified: "warning",
  converted: "success",
  closed: "danger",
};

/** A lead's status as a pill: icon or dot, word and colour together, never colour alone. */
export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const tone = TONES[status];
  return (
    <Badge tone={tone} size="sm" dot={tone === "neutral"}>
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  );
}

const packageNames = new Map(packages.map((p) => [p.slug, p.name]));

/** The package a visitor picked on the contact form, by name. */
export const packageName = (code: string | null) => (code && packageNames.get(code)) ?? "Not sure yet";
