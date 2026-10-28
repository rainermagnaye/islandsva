import type { ReactNode } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import type { Tone } from "@/components/ui/tone";
import { cx } from "@/lib/cx";

export type AssistantView = {
  id: string;
  name: string;
  href: string;
  photoSrc?: string;
  tone: Tone;
  /** "Executive · 20 hrs a week" */
  plan: string;
  /** "10:54 AM in Manila, 10:54 PM for you" */
  clock: string;
  open: number;
  review: number;
  closed: number;
  next: { title: string; href: string; due: string; overdue: boolean } | null;
};

/**
 * One VA on the client's "My assistants" page: who they are, three counts, the task due next, and the actions
 * the page passes in (message, add task), with a link to their profile.
 */
export function AssistantCard({ va, actions }: { va: AssistantView; actions: ReactNode }) {
  const headingId = `assistant-${va.id}`;
  return (
    <li aria-labelledby={headingId} className="grid content-start gap-5 rounded-lg border border-border bg-surface-card p-6">
      <div className="flex items-start gap-4">
        <Avatar name={va.name} src={va.photoSrc} tone={va.tone} size="lg" />
        <div className="grid min-w-0 flex-1 gap-1">
          <h3 id={headingId} className="m-0 type-h4">
            <Link href={va.href} className="text-ink no-underline hover:underline">
              {va.name}
            </Link>
          </h3>
          <p className="m-0 type-body-sm text-ink-muted">{va.plan}</p>
          <p className="m-0 type-caption text-ink-muted">{va.clock}</p>
        </div>
      </div>

      <dl className="m-0 grid grid-cols-3 overflow-hidden rounded-md border border-border">
        <Count label="Open" value={va.open} />
        <Count label="In review" value={va.review} highlight={va.review > 0} />
        <Count label="Closed this month" value={va.closed} />
      </dl>

      <div className="grid gap-2">
        <h4 className="m-0 type-eyebrow text-ink-muted">Up next</h4>
        {va.next ? (
          <Link href={va.next.href} className="flex min-h-11 items-center gap-3 rounded-md bg-surface-sunken px-3 py-2 text-ink no-underline hover:bg-action-ghost-hover">
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-semibold">{va.next.title}</span>
              <span className="type-body-sm text-ink-muted">{va.next.due}</span>
            </span>
            {va.next.overdue && (
              <Badge tone="danger" size="sm">
                Overdue
              </Badge>
            )}
            <Icon name="chevron-right" />
          </Link>
        ) : (
          <p className="m-0 rounded-md bg-surface-sunken px-3 py-2 type-body-sm text-ink-muted">Nothing due. Add a task to get {va.name} started.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {actions}
        <Link href={va.href} className="ml-auto inline-flex min-h-11 items-center gap-1 font-semibold">
          View profile
          <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </li>
  );
}

function Count({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cx("grid gap-0.5 border-l border-border px-4 py-3 first:border-l-0", highlight && "bg-status-warning-bg")}>
      <dt className="type-caption font-semibold text-ink-muted">{label}</dt>
      <dd className="m-0 type-h3">{value}</dd>
    </div>
  );
}
