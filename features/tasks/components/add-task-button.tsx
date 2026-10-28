"use client";

import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

const TaskForm = lazy(() => import("./task-form").then((m) => ({ default: m.TaskForm })));

/**
 * "Add task" as a button that opens the task form in a dialog, closing once the task is saved. With `va` (a VA's
 * card or profile) the task is for that VA, shown in the form; with `vas` (a general page) the form asks which.
 */
export function AddTaskButton({
  va,
  vas,
  today,
  last,
  timeZone,
  variant = "primary",
  size = "md",
}: {
  va?: { id: string; firstName: string };
  vas?: readonly { id: string; firstName: string }[];
  today: string;
  last: string;
  timeZone: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        iconLeft="plus"
        onClick={() => {
          setFormKey((key) => key + 1);
          setOpen(true);
        }}
      >
        Add task
      </Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Add a task">
          <Suspense fallback={null}>
            <TaskForm key={formKey} vaId={va?.id} vaName={va?.firstName} vas={vas} today={today} last={last} timeZone={timeZone} stay onSaved={() => setOpen(false)} />
          </Suspense>
        </Modal>
      )}
    </>
  );
}
