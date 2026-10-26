"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { setTaskStatus } from "../actions";
import type { TaskStatus, TaskStatusField } from "../contract";

/** One button per next status. Closing and starting are buttons, not a checkbox. */
export function TaskStatusForm({ taskId, options }: { taskId: string; options: readonly { status: TaskStatus; label: string }[] }) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-start gap-3">
      {options.map((option) => (
        <Form<TaskStatusField> key={option.status} aria-label={option.label} onSubmit={setTaskStatus}>
          {({ pending }) => (
            <>
              <input type="hidden" name="taskId" value={taskId} />
              <input type="hidden" name="status" value={option.status} />
              <Button type="submit" variant={option.status === "done" ? "primary" : "ghost"} size="sm" loading={pending}>
                {pending ? "Saving" : option.label}
              </Button>
            </>
          )}
        </Form>
      ))}
    </div>
  );
}
