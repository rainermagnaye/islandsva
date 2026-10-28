"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Stepper } from "@/components/ui/stepper";
import { deleteTask } from "../actions";
import { TASK_SEVERITY_LABELS, TASK_STATUS_LABELS, TASK_STATUS_TONES, type Task } from "../contract";
import { nextStatuses } from "../metrics";
import { FeedbackDialog, MoveButton, SubmitDialog } from "./task-moves";
import { TaskForm } from "./task-form";

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

      {viewer === "client" && (
        <>
          <Modal open={dialog === "edit"} onClose={close} title="Edit task" size="wide">
            {dialog === "edit" && edit && <TaskForm today={edit.today} last={edit.last} timeZone={edit.timeZone} task={task} onSaved={close} />}
          </Modal>
          <FeedbackDialog open={dialog === "feedback"} onClose={close} taskId={task.id} vaFirstName={task.vaFirstName} reopen={reopen} />
          <Modal
            open={dialog === "close"}
            onClose={close}
            title="Close without review?"
            description={`The task closes now. ${task.vaFirstName} won't be asked to submit it.`}
            role="alertdialog"
            footer={
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={close}>
                  Keep it open
                </Button>
                <MoveButton taskId={task.id} status="done" label="Close task" pendingLabel="Closing" variant="primary" />
              </div>
            }
          />
          <Modal
            open={dialog === "delete"}
            onClose={close}
            title="Delete this task?"
            description="This removes the task, its comments, files and activity."
            role="alertdialog"
            footer={<DeleteFooter taskId={task.id} onCancel={close} />}
          />
        </>
      )}
      {viewer === "va" && <SubmitDialog open={dialog === "submit"} onClose={close} taskId={task.id} companyName={task.companyName} />}
    </Card>
  );
}

function DeleteFooter({ taskId, onCancel }: { taskId: string; onCancel: () => void }) {
  return (
    <Form aria-label="Delete this task" onSubmit={deleteTask}>
      {({ pending }) => (
        <>
          <input type="hidden" name="taskId" value={taskId} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              {pending ? "Deleting" : "Delete task"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
