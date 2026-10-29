// The dashboard's heading: the time of day and today's date, both in the client's zone.

const hourIn = (now: Date, timeZone: string) =>
  Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(now));

/** "Good morning" until noon, "Good afternoon" until 6 pm, then "Good evening". */
export function greeting(now: Date, timeZone: string): string {
  const hour = hourIn(now, timeZone);
  if (hour < 12) return "Good morning";
  return hour < 18 ? "Good afternoon" : "Good evening";
}

/** "Wednesday, October 28". */
export const longDay = (now: Date, timeZone: string) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone }).format(now);
