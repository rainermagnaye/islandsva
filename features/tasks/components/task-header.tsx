"use client";

import { lazy, Suspense, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import { Stepper } from "@/components/ui/stepper";
import { TASK_SEVERITY_LABELS, TASK_STATUS_LABELS, TASK_STATUS_TONES, type Task } from "../contract";
import { nextStatuses } from "../metrics";
import { MoveButton } from "./task-moves";

const ClientTaskDialogs = lazy(() => import("./task-header-dialogs").then((m) => ({ default: m.ClientTaskDialogs })));
const FeedbackDialog = lazy(() => import("./task-move-dialogs").then((m) => ({ default: m.FeedbackDialog })));
const SubmitDialog = lazy(() => import("./task-move-dialogs").then((m) => ({ default: m.SubmitDialog })));

export type TaskNotice = { tone: "info" | "success" | "warning"; title: string; body: string; quote?: string | null };

/**
 * The task's header card: title and badges, the next moves for whoever is looking, the four-step progress,
 * and a notice for the current step. The database still decides every move (guard_task).
 */
export function TaskHeader({
  task,
  viewer,
  meta,
  steps,
  step,
  notice,
  canMove,
  waiting,
  edit,
}: {
  task: Task;
  viewer: "client" | "va";
  meta: string;
  steps: readonly { label: string; description: string }[];
  step: number;
  notice: TaskNotice | null;
  /** The VA still on the assignment, or the client (who may always review and close). */
  canMove: boolean;
  /** Shown instead of buttons while the other side has the task. */
  waiting: string | null;
  /** The client's edit form, when the task is open and the company can still change it. */
  edit: { today: string; last: string; timeZone: string } | null;
}) {
  const [dialog, setDialog] = useState<"edit" | "feedback" | "submit" | "close" | "delete" | null>(null);
  const [copied, setCopied] = useState(false);
  const close = () => setDialog(null);
  const moves = canMove ? nextStatuses(task.status, viewer) : [];
  const reopen = task.status === "done";

  const items: MenuItem[] = [
    ...(viewer === "client" ? [{ label: "Edit task", icon: "edit" as const, disabled: edit === null, onSelect: () => setDialog("edit") }] : []),
    {
      label: copied ? "Link copied" : "Copy link",
      icon: "copy",
      onSelect: () => {
        void navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true));
      },
    },
    ...(viewer === "client" && (task.status === "todo" || task.status === "in_progress")
      ? [{ label: "Close without review", icon: "check-circle" as const, onSelect: () => setDialog("close") }]
      : []),
    ...(viewer === "client" ? [{ separator: true } as const, { label: "Delete task", icon: "trash" as const, danger: true, onSelect: () => setDialog("delete") }] : []),
  ];

  return (
    <Card as="section" aria-label="Task" className="grid gap-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="grid min-w-0 flex-[1_1_22rem] gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 min-w-0 break-words type-h2">{task.title}</h1>
            <Badge tone={TASK_STATUS_TONES[task.status]} size="sm">
              {TASK_STATUS_LABELS[task.status]}
            </Badge>
            <Badge tone="neutral" size="sm" dot icon={null}>
              {TASK_SEVERITY_LABELS[task.severity]} priority
            </Badge>
          </div>
          <p className="m-0 type-body-sm text-ink-muted">{meta}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {waiting && <p className="m-0 type-body-sm text-ink-muted">{waiting}</p>}
          {viewer === "client" && task.status === "review" && moves.length > 0 && (
            <>
              <Button type="button" variant="ghost" iconLeft="message" onClick={() => setDialog("feedback")}>
                Request changes
              </Button>
              <MoveButton taskId={task.id} status="done" label="Approve and close" pendingLabel="Closing" icon="check" />
            </>
          )}
          {viewer === "client" && reopen && moves.includes("in_progress") && (
            <Button type="button" variant="ghost" onClick={() => setDialog("feedback")}>
              Reopen task
            </Button>
          )}
          {viewer === "va" && moves.includes("in_progress") && <MoveButton taskId={task.id} status="in_progress" label="Start task" pendingLabel="Starting" variant="ghost" />}
          {viewer === "va" && moves.includes("review") && (
            <Button type="button" variant="secondary" iconLeft="inbox" onClick={() => setDialog("submit")}>
              Submit for review
            </Button>
          )}
          <DropdownMenu label="More actions" icon="more" iconOnly align="end" items={items} />
        </div>
      </div>

      <Stepper label="Task progress" steps={steps} current={step} />

      {notice && (
        <Alert tone={notice.tone} title={notice.title}>
          <p className="m-0">{notice.body}</p>
          {notice.quote && <blockquote className="m-0 mt-2 whitespace-pre-wrap break-words type-body-sm">{notice.quote}</blockquote>}
        </Alert>
      )}

      {viewer === "client" && (dialog === "edit" || dialog === "close" || dialog === "delete") && (
        <Suspense fallback={null}>
          <ClientTaskDialogs dialog={dialog} task={task} edit={edit} onClose={close} />
        </Suspense>
      )}
      {dialog === "feedback" && (
        <Suspense fallback={null}>
          <FeedbackDialog open onClose={close} taskId={task.id} vaFirstName={task.vaFirstName} reopen={reopen} />
        </Suspense>
      )}
      {dialog === "submit" && (
        <Suspense fallback={null}>
          <SubmitDialog open onClose={close} taskId={task.id} companyName={task.companyName} />
        </Suspense>
      )}
    </Card>
  );
}
