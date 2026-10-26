"use client";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { createTask, updateTask } from "../actions";
import { TASK_LIMITS, type Task, type TaskField } from "../contract";

/** Add a task, or change its title and deadline. One VA is chosen by the server. Several need a choice. */
export function TaskForm({
  today,
  last,
  timeZone,
  task,
  vas = [],
}: {
  today: string;
  last: string;
  timeZone: string;
  task?: Task;
  vas?: readonly { id: string; firstName: string }[];
}) {
  const editing = task !== undefined;
  return (
    <Form<TaskField> aria-label={editing ? "Edit task" : "Add a task"} onSubmit={editing ? updateTask : createTask} className="gap-4">
      {({ pending, fieldErrors }) => (
        <>
          {task && <input type="hidden" name="taskId" value={task.id} />}
          {vas.length > 1 && (
            <Select label="VA" name="vaId" required placeholder="Choose a VA" options={vas.map((va) => ({ value: va.id, label: va.firstName }))} error={fieldErrors.vaId} />
          )}
          <TextField label="Title" name="title" required maxLength={TASK_LIMITS.title} defaultValue={task?.title} error={fieldErrors.title} />
          <div className="max-w-60">
            <DatePicker
              label="Deadline"
              name="deadline"
              required
              min={today}
              max={last}
              timeZone={timeZone}
              defaultValue={task?.deadline ?? today}
              error={fieldErrors.deadline}
              hint="A day in your company's time zone, from today through the next year."
            />
          </div>
          <div>
            <Button type="submit" variant={editing ? "secondary" : "primary"} loading={pending}>
              {pending ? "Saving" : editing ? "Save task" : "Add task"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
