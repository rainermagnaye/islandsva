import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { cardSurface } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { Tone } from "@/components/ui/tone";
import { cx } from "@/lib/cx";
import { NEAR_LIMIT, type ClientRow } from "./client-rows";

const TONES: readonly Tone[] = ["lagoon", "ocean", "coral", "sand"];
const label = "type-caption font-semibold text-ink-muted";

/**
 * One client on one line (it wraps on narrow screens): who they are, their time now, this week's hours, open
 * work, and the email action at the right edge so it never adds a line.
 */
export function ClientCard({ row, index }: { row: ClientRow; index: number }) {
  return (
    <li className={cx(cardSurface, "flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-4")}>
      <div className="flex min-w-0 flex-[1.4_1_15rem] items-center gap-3.5">
        <Avatar name={row.company} tone={TONES[index % TONES.length]} />
        <div className="grid min-w-0 gap-0.5">
          <span className="truncate type-body font-semibold text-ink">{row.company}</span>
          <span className="truncate type-body-sm text-ink-muted">{row.contact}</span>
          <a href={`mailto:${row.email}`} className="type-body-sm break-all">
            {row.email}
          </a>
        </div>
      </div>

      <div className="grid min-w-0 flex-[1_1_12rem] content-start gap-1">
        <span className={label}>Their time now</span>
        {row.time ? (
          <>
            <span
              className={cx(
                "inline-flex items-center gap-2 justify-self-start rounded-pill px-3 py-1.5 type-label",
                row.time.day ? "bg-shift-day-bg text-shift-day-ink" : "bg-shift-night-bg text-shift-night-ink",
              )}
            >
              <Icon name={row.time.day ? "sun" : "moon"} size={16} />
              {row.time.clock} · {row.time.city}
            </span>
            <span className="type-caption text-ink-muted">{row.time.line}</span>
          </>
        ) : (
          <>
            <span className="justify-self-start">
              <Badge tone="warning" size="sm">
                Time zone not set
              </Badge>
            </span>
            <span className="type-caption text-ink-muted">Ask your admin to add it</span>
          </>
        )}
      </div>

      <div className="grid min-w-0 flex-[1_1_11rem] content-start gap-1">
        {row.hours ? (
          <ProgressBar label="This week" value={row.hours.used} max={row.hours.agreed} valueText={`${row.hours.used} of ${row.hours.agreed} h`} warnAt={NEAR_LIMIT * 100} />
        ) : (
          <>
            <span className={label}>This week</span>
            <span className="justify-self-start">
              <Badge tone="neutral" size="sm">
                Hours not agreed yet
              </Badge>
            </span>
          </>
        )}
      </div>

      <div className="grid min-w-0 flex-[1_1_10rem] content-start gap-1.5">
        <span className={label}>Open work</span>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={row.open > 0 ? "info" : "neutral"} size="sm">
            {row.open > 0 ? `${row.open} open` : "No open tasks"}
          </Badge>
          {row.overdue > 0 && (
            <Badge tone="danger" size="sm">
              {row.overdue} overdue
            </Badge>
          )}
          {row.delayed > 0 && (
            <Badge tone="warning" size="sm">
              {row.delayed} delayed
            </Badge>
          )}
        </div>
        <span className="type-caption text-ink-muted">Client since {row.since}</span>
      </div>

      <div className="ml-auto flex shrink-0 items-center">
        <a href={`mailto:${row.email}`} className={buttonClasses({ variant: "ghost", size: "sm" })} aria-label={`Email ${row.contact} at ${row.company}`}>
          <Icon name="mail" />
          <span>Email</span>
        </a>
      </div>
    </li>
  );
}
