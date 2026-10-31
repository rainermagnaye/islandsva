"use client";

import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import type { IconName } from "@/types/icon";
import { setTaskStatus } from "../actions";
import type { TaskStatus, TaskStatusField } from "../contract";

/** One move with no note, as its own small form so it works before the page's JavaScript loads. */
export function MoveButton({
  taskId,
  status,
  label,
  pendingLabel = "Saving",
  variant = "secondary",
  icon,
}: {
  taskId: string;
  status: TaskStatus;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
  icon?: IconName;
}) {
  return (
    <Form<TaskStatusField> aria-label={label} onSubmit={setTaskStatus}>
      {({ pending }) => (
        <>
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="status" value={status} />
          <Button type="submit" variant={variant} iconLeft={icon} loading={pending}>
            {pending ? pendingLabel : label}
          </Button>
        </>
      )}
    </Form>
  );
}

const SubmitDialog = lazy(() => import("./task-move-dialogs").then((m) => ({ default: m.SubmitDialog })));

/** The VA's Complete: opens the handover dialog (optional note), which sends the task to review. */
export function CompleteButton({ taskId, companyName, variant = "primary" }: { taskId: string; companyName: string; variant?: "primary" | "ghost" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} iconLeft="check" onClick={() => setOpen(true)}>
        Complete task
      </Button>
      {open && (
        <Suspense fallback={null}>
          <SubmitDialog open onClose={() => setOpen(false)} taskId={taskId} companyName={companyName} />
        </Suspense>
      )}
    </>
  );
}
