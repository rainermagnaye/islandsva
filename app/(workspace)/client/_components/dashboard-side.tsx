import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/components/ui/date-math";
import type { Tone } from "@/components/ui/tone";
import type { AgendaItem, AgendaKind } from "@/features/meetings/agenda";
import { cx } from "@/lib/cx";

const DOT: Record<AgendaKind, string> = { deadline: "bg-tag-coral-ink", meeting: "bg-tag-ocean-ink", demo: "bg-tag-lagoon-ink" };

function CardHeading({ id, title, href, link }: { id: string; title: string; href: string; link: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="m-0 type-h4">
        {title}
      </h2>
      <Link href={href} className="type-label no-underline">
        {link}
      </Link>
    </div>
  );
}

/** The next few things this week, each on a day tile. A meeting opens the calendar, the rest their own page. */
export function ComingUpCard({ items, today, calendarHref }: { items: readonly AgendaItem[]; today: string; calendarHref: string }) {
  return (
    <Card as="section" padding="none" aria-labelledby="dashboard-next" className="grid content-start gap-4 p-5">
      <CardHeading id="dashboard-next" title="Coming up" href={calendarHref} link="Calendar" />
      {items.length === 0 ? (
        <p className="m-0 type-body-sm text-ink-muted">Nothing scheduled this week.</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href ?? calendarHref} className="flex items-center gap-3 rounded-md bg-surface-sunken px-3.5 py-3 text-ink no-underline hover:bg-action-ghost-hover">
                <span className={cx("flex w-12 shrink-0 flex-col items-center gap-1", item.date === today ? "text-action-secondary" : "text-ink")}>
                  <span className="type-caption font-bold uppercase">{item.date === today ? "Today" : formatDate(item.date, { weekday: "short" })}</span>
                  <span className="type-h4 font-bold tabular-nums">{Number(item.date.slice(8, 10))}</span>
                </span>
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-pill", DOT[item.kind])} />
                    <span className="truncate type-body-sm font-semibold">{item.title}</span>
                  </span>
                  <span className="type-caption text-ink-muted">
                    {item.when}
                    {item.kind === "meeting" && item.who ? ` · ${item.who}` : ""}
                    {item.badge && item.kind !== "deadline" ? ` · ${item.badge.label}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export type TeamMember = {
  id: string;
  name: string;
  href: string;
  photoSrc?: string;
  tone: Tone;
  /** "2 open · 1 in review", or "Nothing open". */
  work: string;
  /** Shown only when something needs the client: late work, or work waiting for review. */
  flag: { label: string; tone: "danger" | "warning" } | null;
};

/** The client's assistants and what each has on, or `empty` (the demo-call card) before they have one. */
export function TeamCard({ team, allHref, empty }: { team: readonly TeamMember[]; allHref: string; empty: ReactNode }) {
  return (
    <Card as="section" padding="none" aria-labelledby="dashboard-team" className="grid content-start gap-4 p-5">
      <CardHeading id="dashboard-team" title="My assistants" href={allHref} link="View all" />
      {team.length === 0 ? (
        empty
      ) : (
        <ul className="m-0 grid list-none gap-1 p-0">
          {team.map((member) => (
            <li key={member.id}>
              <Link href={member.href} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md p-2 text-ink no-underline hover:bg-surface-sunken">
                <Avatar name={member.name} src={member.photoSrc} tone={member.tone} />
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate type-body font-semibold">{member.name}</span>
                  <span className="type-caption text-ink-muted">{member.work}</span>
                </span>
                {member.flag && (
                  <Badge tone={member.flag.tone} size="sm" dot>
                    {member.flag.label}
                  </Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
