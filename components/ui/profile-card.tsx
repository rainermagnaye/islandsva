import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Avatar } from "./avatar";
import { Badge } from "./badge";
import { cardSurface } from "./card";
import { Icon } from "./icon";
import type { Tone } from "./tone";

const PRESENCE = {
  online: { label: "On shift", tone: "success", dot: "bg-status-success" },
  away: { label: "Away", tone: "warning", dot: "bg-status-warning" },
  offline: { label: "Off shift", tone: "neutral", dot: "bg-ink-muted" },
} as const;

type ProfileCardProps = {
  name: string;
  role?: string;
  avatar?: string;
  tone?: Tone;
  status?: keyof typeof PRESENCE;
  /** Both zones when they differ: "9:42 pm in Manila · 9:42 am for you". */
  localTime?: string;
  /** Up to five. */
  skills?: readonly string[];
  /** Two or three factual, recent numbers. */
  stats?: readonly { label: string; value: string }[];
  /** Usually "Message" (secondary) and "Schedule" (ghost). */
  actions?: ReactNode;
  className?: string;
};

/** Introduces a VA or a client contact: who, whether they're on shift, their local time, skills and how to reach them. */
export function ProfileCard({ name, role, avatar, tone, status, localTime, skills = [], stats = [], actions, className }: ProfileCardProps) {
  const presence = status ? PRESENCE[status] : null;
  return (
    <section aria-label={name} className={cx(cardSurface, "grid gap-4 p-6", className)}>
      <div className="flex items-center gap-4">
        <span className="relative">
          <Avatar name={name} src={avatar} tone={tone} />
          {presence && <span aria-hidden="true" className={cx("absolute right-0 bottom-0 size-3 rounded-pill ring-2 ring-surface-card", presence.dot)} />}
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h3 className="m-0 truncate type-h4 text-ink">{name}</h3>
          {role && <p className="m-0 type-body-sm text-ink-muted">{role}</p>}
        </div>
        {presence && (
          <Badge tone={presence.tone} size="sm" dot>
            {presence.label}
          </Badge>
        )}
      </div>
      {localTime && (
        <p className="m-0 inline-flex items-center gap-2 type-body-sm text-ink">
          <Icon name="clock" size={16} className="text-ink-muted" />
          {localTime}
        </p>
      )}
      {skills.length > 0 && (
        <ul aria-label="Skills" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {skills.slice(0, 5).map((skill) => (
            <li key={skill} className="rounded-pill bg-surface-sunken px-2.5 py-1 type-caption whitespace-nowrap text-ink">
              {skill}
            </li>
          ))}
        </ul>
      )}
      {stats.length > 0 && (
        <dl className="m-0 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="grid gap-0.5">
              <dt className="type-caption text-ink-muted">{stat.label}</dt>
              <dd className="m-0 type-label text-ink tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}
