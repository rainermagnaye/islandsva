"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { createTask, updateTask } from "../actions";
import { TASK_LIMITS, type Task, type TaskField } from "../contract";
import { DeadlineFields } from "./deadline-fields";
import { SeverityDurationFields } from "./severity-duration-fields";
import { VaAssignField } from "./va-assign-field";

/**
 * Add a task, or change its title, severity, duration and deadline. A new task names its VAs: chosen in the form when it opens from
 * a general place, or fixed (shown, not editable) when it opens from one VA's card or profile.
 */
export function TaskForm({
  today,
  last,
  timeZone,
  task,
  vas = [],
  vaId,
  vaName,
  stay = false,
  onSaved,
}: {
  today: string;
  last: string;
  timeZone: string;
  task?: Task;
  vas?: readonly { id: string; firstName: string }[];
  /** When the page is already about one VA, the form posts that id and shows them in place of the choice. */
  vaId?: string;
  /** That VA's first name, shown as the assigned VA. */
  vaName?: string;
  /** Stay on this page after a new task, instead of opening the task. */
  stay?: boolean;
  /** Called after a save that stays on the page, so a modal can close. */
  onSaved?: () => void;
}) {
  const editing = task !== undefined;
  return (
    <Form<TaskField>
      aria-label={editing ? "Edit task" : "Add a task"}
      onSubmit={async (formData) => {
        const result = await (editing ? updateTask : createTask)(formData);
        if (result.ok) onSaved?.();
        return result;
      }}
      className="gap-4"
    >
      {({ pending, fieldErrors }) => (
        <>
          {task && <input type="hidden" name="taskId" value={task.id} />}
          {vaId && <input type="hidden" name="vaId" value={vaId} />}
          {stay && <input type="hidden" name="stay" value="1" />}
          <TextField label="Title" name="title" required maxLength={TASK_LIMITS.title} defaultValue={task?.title} error={fieldErrors.title} />
          <TextField label="Description" name="description" multiline optional maxLength={TASK_LIMITS.description} defaultValue={task?.description ?? ""} error={fieldErrors.description} />
          <SeverityDurationFields
            severity={task?.severity}
            durationMinutes={task?.durationMinutes}
            severityError={fieldErrors.severity}
            hoursError={fieldErrors.durationHours}
            minutesError={fieldErrors.durationMinutes}
          />
          <DeadlineFields
            today={today}
            last={last}
            timeZone={timeZone}
            deadline={task?.deadline}
            deadlineTime={task?.deadlineTime}
            dateError={fieldErrors.deadline}
            timeError={fieldErrors.deadlineTime}
          />
          {!editing && vaId && vaName && (
            <div className="grid gap-2">
              <span className="type-label text-ink">Assigned VA</span>
              <p className="m-0 flex min-h-11 items-center gap-3 rounded-md bg-surface-sunken px-3 type-body">
                <Avatar name={vaName} size="sm" />
                {vaName}
              </p>
            </div>
          )}
          {!editing && !vaId && <VaAssignField vas={vas} error={fieldErrors.vaId} />}
          <div>
            <Button type="submit" variant={editing || stay ? "secondary" : "primary"} loading={pending}>
              {pending ? "Saving" : editing ? "Save task" : "Add task"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
