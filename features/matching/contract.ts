// The VA shortlist and a VA's weekly hours. No Zod, safe for client imports.

export const SHORTLIST_STATUSES = ["offered", "accepted", "declined"] as const;
export type ShortlistStatus = (typeof SHORTLIST_STATUSES)[number];

export const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
] as const;

export type ShortlistEntry = {
  id: string;
  clientId: string;
  vaId: string;
  status: ShortlistStatus;
  vaFirstName: string;
  companyName: string;
  createdAt: string;
};

export type WorkingWindow = {
  id: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
};

/** 00:00 through 23:30, then 24:00, on the half hour. */
export function minuteOptions(includeMidnightEnd: boolean) {
  const last = includeMidnightEnd ? 1440 : 1410;
  const options: { value: string; label: string }[] = [];
  for (let minute = includeMidnightEnd ? 30 : 0; minute <= last; minute += 30) {
    const hours = Math.floor(minute / 60);
    const mins = minute % 60;
    options.push({ value: String(minute), label: `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}` });
  }
  return options;
}

export function formatMinutes(minute: number) {
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
