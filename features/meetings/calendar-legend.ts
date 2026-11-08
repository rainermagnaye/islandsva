import type { Tone } from "@/components/ui/tone";

/** Kind chips on the calendar. Status (requested, scheduled, …) lives on the schedules list. */
export const KIND_LEGEND: readonly { tone: Tone; label: string }[] = [
  { tone: "lagoon", label: "Meetings" },
  { tone: "sand", label: "Demo calls" },
  { tone: "coral", label: "Tasks" },
];

export const CLOSER_LEGEND: readonly { tone: Tone; label: string }[] = [
  { tone: "lagoon", label: "Meetings" },
  { tone: "sand", label: "Discovery requests" },
  { tone: "coral", label: "Tasks" },
];
