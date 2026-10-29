import { clockLabel, minutesOf, wallClockIn, zoneCity } from "@/components/ui/date-math";
import { Icon } from "@/components/ui/icon";
import { safeTimeZone } from "@/features/demos/contract";
import { cx } from "@/lib/cx";

// Daytime for the sun chip: 6 am up to 6 pm on the client's clock.
const DAY_START = 6 * 60;
const DAY_END = 18 * 60;

/**
 * The time where each client is, as of the page load: a sun chip in their daytime, a moon at night, so the VA
 * sees at a glance who is awake. One chip per zone; clients without a zone are left out.
 */
export function ClientClocks({ zones, now }: { zones: readonly (string | null)[]; now: Date }) {
  const known = [...new Set(zones.filter((zone): zone is string => zone !== null).map(safeTimeZone))].filter((zone) => zone !== "UTC" || zones.includes("UTC"));
  if (known.length === 0) return null;
  const clocks = known
    .map((zone) => ({ zone, minutes: minutesOf(wallClockIn(now.toISOString(), zone)) }))
    .sort((a, b) => a.minutes - b.minutes || a.zone.localeCompare(b.zone));

  return (
    <ul aria-label="Your clients' local time" className="m-0 flex list-none flex-wrap gap-2 p-0">
      {clocks.map(({ zone, minutes }) => {
        const day = minutes >= DAY_START && minutes < DAY_END;
        return (
          <li
            key={zone}
            className={cx(
              "inline-flex min-h-9 items-center gap-2 rounded-pill px-3.5 type-body-sm font-semibold",
              day ? "bg-shift-day-bg text-shift-day-ink" : "bg-shift-night-bg text-shift-night-ink",
            )}
          >
            <Icon name={day ? "sun" : "moon"} size={16} />
            <span>{zoneCity(zone)}</span>
            <span className="font-medium text-ink tabular-nums">{clockLabel(minutes)}</span>
          </li>
        );
      })}
    </ul>
  );
}
