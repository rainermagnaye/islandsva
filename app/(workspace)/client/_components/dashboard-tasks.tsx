"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import type { Tone } from "@/components/ui/tone";
import { cx } from "@/lib/cx";

export type DashboardTask = {
  id: string;
  title: string;
  href: string;
  va: string;
  photoSrc?: string;
  tone: Tone;
  /** "Due tomorrow, 2:30 pm", "Closed Oct 27 · on time". */
  line: string;
  late: boolean;
  status: { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" };
  group: TaskTab;
};

type TaskTab = "open" | "review" | "closed";

const TABS: readonly (readonly [TaskTab, string])[] = [["open", "Open"], ["review", "In review"], ["closed", "Closed"]];

const EMPTY: Record<TaskTab, { title: string; body: string }> = {
  open: { title: "Nothing open", body: "Tasks with your VAs show up here." },
  review: { title: "Nothing to review", body: "Tasks your VA submits for review show up here." },
  closed: { title: "No closed tasks yet", body: "Tasks you approve or close show up here." },
};

/** The dashboard's task list: open, in review and recently closed, each row opening the task. */
export function DashboardTasks({ tasks, allHref, emptyOpen }: { tasks: readonly DashboardTask[]; allHref: string; emptyOpen?: { title: string; body: string } }) {
  const [tab, setTab] = useState<TaskTab>("open");
  const shown = tasks.filter((task) => task.group === tab);
  const empty = tab === "open" && emptyOpen ? emptyOpen : EMPTY[tab];

  return (
    <Card as="section" padding="none" aria-labelledby="dashboard-tasks" className="min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
        <h2 id="dashboard-tasks" className="m-0 type-h4">
          Tasks
        </h2>
        <Link href={allHref} className="inline-flex items-center gap-1 type-label no-underline">
          All tasks <Icon name="chevron-right" size={18} />
        </Link>
      </div>
      <nav aria-label="Filter tasks" className="mx-6 mt-2 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-current={tab === value ? "page" : undefined}
            onClick={() => setTab(value)}
            className={cx(
              "flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border-0 bg-transparent px-3 type-menu whitespace-nowrap",
              tab === value ? "text-action-secondary shadow-[inset_0_-2px_0_var(--color-action-secondary)]" : "text-ink-muted hover:text-ink",
            )}
          >
            {label}
            <span className="grid h-5.5 min-w-5.5 place-items-center rounded-pill bg-surface-sunken px-1.5 type-caption text-ink-muted">
              {tasks.filter((task) => task.group === value).length}
            </span>
          </button>
        ))}
      </nav>
      {shown.length === 0 ? (
        <div className="grid justify-items-center gap-2 px-6 pt-10 pb-12 text-center">
          <span aria-hidden="true" className="grid size-12 place-items-center rounded-pill bg-surface-sunken text-ink-muted">
            <Icon name="inbox" />
          </span>
          <p className="m-0 type-label text-ink">{empty.title}</p>
          <p className="m-0 max-w-sm type-body-sm text-ink-muted">{empty.body}</p>
        </div>
      ) : (
        <ul className="m-0 grid list-none gap-0.5 px-3 pt-2 pb-3">
          {shown.map((task) => (
            <li key={task.id}>
              <Link href={task.href} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3.5 rounded-md p-3 text-ink no-underline hover:bg-surface-sunken">
                <Avatar name={task.va} src={task.photoSrc} tone={task.tone} />
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate type-body font-semibold">{task.title}</span>
                  <span className={cx("type-body-sm", task.late ? "text-status-danger" : "text-ink-muted")}>
                    {task.va} · {task.line}
                  </span>
                </span>
                <Badge tone={task.status.tone} size="sm" dot>
                  {task.status.label}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
