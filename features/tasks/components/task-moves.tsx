"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import type { IconName } from "@/types/icon";
import { sendTaskBack, setTaskStatus, submitTask } from "../actions";
import { TASK_LIMITS, type TaskNoteField, type TaskStatus, type TaskStatusField } from "../contract";

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

/**
 * The client's feedback when work goes back to the VA: "Request changes" on a review, or a reopen. Required,
 * because the VA works from it, and it shows in the task's activity.
 */
export function FeedbackDialog({ open, onClose, taskId, vaFirstName, reopen }: { open: boolean; onClose: () => void; taskId: string; vaFirstName: string; reopen: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={reopen ? "Reopen this task?" : "Request changes"}
      description={`Tell ${vaFirstName} what needs to change. They'll see it in the task's activity, and the task moves back to In progress.`}
    >
      {open && (
        <NoteForm
          taskId={taskId}
          onDone={onClose}
          onCancel={onClose}
          action={sendTaskBack}
          label="What needs to change?"
          hint="Be specific: what's missing, what's wrong, and what done looks like."
          required
          submitLabel={reopen ? "Reopen task" : "Send feedback"}
        />
      )}
    </Modal>
  );
}

/** The VA hands the task over. The note is optional: what was done and where to find it. */
export function SubmitDialog({ open, onClose, taskId, companyName }: { open: boolean; onClose: () => void; taskId: string; companyName: string }) {
  return (
    <Modal open={open} onClose={onClose} title="Submit for review" description={`${companyName} will approve it or ask for changes. Until then the task stays in review.`}>
      {open && (
        <NoteForm
          taskId={taskId}
          onDone={onClose}
          onCancel={onClose}
          action={submitTask}
          label="Handover note"
          hint="What you did, and where to find it."
          required={false}
          submitLabel="Submit for review"
        />
      )}
    </Modal>
  );
}

function NoteForm({
  taskId,
  onDone,
  onCancel,
  action,
  label,
  hint,
  required,
  submitLabel,
}: {
  taskId: string;
  onDone: () => void;
  onCancel: () => void;
  action: typeof sendTaskBack;
  label: string;
  hint: string;
  required: boolean;
  submitLabel: string;
}) {
  return (
    <Form<TaskNoteField>
      aria-label={submitLabel}
      onSubmit={async (formData) => {
        const result = await action(formData);
        if (result.ok) onDone();
        return result;
      }}
      className="gap-5"
    >
      {({ pending, fieldErrors }) => (
        <>
          <input type="hidden" name="taskId" value={taskId} />
          <TextField label={label} name="note" multiline rows={5} required={required} optional={!required} maxLength={TASK_LIMITS.note} hint={hint} error={fieldErrors.note} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" loading={pending}>
              {pending ? "Sending" : submitLabel}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
