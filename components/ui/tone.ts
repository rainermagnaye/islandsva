// The design system's four category tones (TagChip, Avatar, ScheduleCalendar events, TaskList assignees,
// Calendar dots). Every bg/ink pair passes 5.7:1 or better in both themes. Full class names, so Tailwind sees them.

export type Tone = "lagoon" | "coral" | "sand" | "ocean";

export const TONE_CLASSES: Record<Tone, { bg: string; ink: string; fill: string; ring: string }> = {
  lagoon: { bg: "bg-tag-lagoon-bg", ink: "text-tag-lagoon-ink", fill: "bg-tag-lagoon-ink", ring: "ring-tag-lagoon-ink" },
  coral: { bg: "bg-tag-coral-bg", ink: "text-tag-coral-ink", fill: "bg-tag-coral-ink", ring: "ring-tag-coral-ink" },
  sand: { bg: "bg-tag-sand-bg", ink: "text-tag-sand-ink", fill: "bg-tag-sand-ink", ring: "ring-tag-sand-ink" },
  ocean: { bg: "bg-tag-ocean-bg", ink: "text-tag-ocean-ink", fill: "bg-tag-ocean-ink", ring: "ring-tag-ocean-ink" },
};

/** The categorical chart palette (see the design system's Data visualization section), in series order. */
export const CHART_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)", "var(--color-chart-6)"] as const;
export const CHART_GRID = "var(--color-chart-grid)";
export const CHART_OTHER = "var(--color-chart-other)";
