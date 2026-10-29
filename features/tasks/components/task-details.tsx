import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/cx";
import type { IconName } from "@/types/icon";
import type { ActivityKind } from "../activity";

export type ActivityView = { key: string; kind: ActivityKind; title: string; who: string | null; when: string; note: string | null };

const MARK: Record<ActivityKind, { icon: IconName; tone: string }> = {
  added: { icon: "plus", tone: "bg-surface-sunken text-ink-muted" },
  started: { icon: "clock", tone: "bg-status-info-bg text-status-info" },
  submitted: { icon: "inbox", tone: "bg-status-warning-bg text-status-warning" },
  changes_requested: { icon: "message", tone: "bg-status-warning-bg text-status-warning" },
  approved: { icon: "check-circle", tone: "bg-status-success-bg text-status-success" },
  closed: { icon: "check-circle", tone: "bg-status-success-bg text-status-success" },
  reopened: { icon: "arrow-up", tone: "bg-status-info-bg text-status-info" },
};

/** The side panel: the task's facts, then its activity — every move, with the handover notes and feedback. */
export function TaskDetails({ facts, activity }: { facts: readonly { label: string; value: ReactNode }[]; activity: readonly ActivityView[] }) {
  return (
    <Card as="section" aria-labelledby="task-details" className="grid content-start gap-4">
      <h2 id="task-details" className="m-0 type-h4">
        Details
      </h2>
      <dl className="m-0 grid gap-4 type-body-sm">
        {facts.map((fact) => (
          <div key={fact.label} className="grid gap-1">
            <dt className="font-semibold text-ink-muted">{fact.label}</dt>
            <dd className="m-0 type-body">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-3 border-t border-border pt-4">
        <h3 id="task-activity" className="m-0 type-label text-ink-muted">
          Activity
        </h3>
        <ol aria-labelledby="task-activity" className="m-0 grid list-none p-0">
          {activity.map((entry, index) => (
            <li key={entry.key} className="grid grid-cols-[1.5rem_1fr] gap-2.5">
              <div className="grid grid-rows-[1.5rem_1fr] justify-items-center">
                <span aria-hidden="true" className={cx("inline-grid size-6 place-items-center rounded-pill", MARK[entry.kind].tone)}>
                  <Icon name={MARK[entry.kind].icon} size={12} />
                </span>
                {index < activity.length - 1 && <span aria-hidden="true" className="mt-1 w-0.5 bg-border" />}
              </div>
              <div className="grid min-w-0 gap-1.5 pt-0.5 pb-4">
                <p className="m-0 type-body-sm">
                  <strong>{entry.title}</strong>
                  <br />
                  <span className="text-ink-muted">{entry.who ? `${entry.who} · ${entry.when}` : entry.when}</span>
                </p>
                {entry.note && (
                  <blockquote
                    className={cx(
                      "m-0 rounded-md px-3 py-2.5 whitespace-pre-wrap break-words type-body-sm",
                      entry.kind === "changes_requested" || entry.kind === "reopened" ? "bg-status-warning-bg" : "bg-surface-sunken",
                    )}
                  >
                    {entry.note}
                  </blockquote>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
