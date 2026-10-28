"use client";

import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { deleteTask } from "../actions";
import type { Task } from "../contract";
import { MoveButton } from "./task-moves";

const TaskForm = lazy(() => import("./task-form").then((m) => ({ default: m.TaskForm })));

/** Edit, close-without-review and delete, loaded when the client opens one. */
export function ClientTaskDialogs({
  dialog,
  task,
  edit,
  onClose,
}: {
  dialog: "edit" | "close" | "delete";
  task: Task;
  edit: { today: string; last: string; timeZone: string } | null;
  onClose: () => void;
}) {
  if (dialog === "edit") {
    return (
      <Modal open onClose={onClose} title="Edit task" size="wide">
        {edit && (
          <Suspense fallback={null}>
            <TaskForm today={edit.today} last={edit.last} timeZone={edit.timeZone} task={task} onSaved={onClose} />
          </Suspense>
        )}
      </Modal>
    );
  }

  if (dialog === "close") {
    return (
      <Modal
        open
        onClose={onClose}
        title="Close without review?"
        description={`The task closes now. ${task.vaFirstName} won't be asked to submit it.`}
        role="alertdialog"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Keep it open
            </Button>
            <MoveButton taskId={task.id} status="done" label="Close task" pendingLabel="Closing" variant="primary" />
          </div>
        }
      />
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Delete this task?"
      description="This removes the task, its comments, files and activity."
      role="alertdialog"
      footer={
        <Form aria-label="Delete this task" onSubmit={deleteTask}>
          {({ pending }) => (
            <>
              <input type="hidden" name="taskId" value={task.id} />
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger" loading={pending}>
                  {pending ? "Deleting" : "Delete task"}
                </Button>
              </div>
            </>
          )}
        </Form>
      }
    />
  );
}
