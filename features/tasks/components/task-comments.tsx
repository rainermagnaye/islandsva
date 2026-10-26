"use client";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { addTaskComment } from "../actions";
import { TASK_LIMITS, type CommentField, type TaskComment } from "../contract";

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/** Comments are plain text. The form is hidden once the caller can no longer add one. */
export function TaskComments({ taskId, comments, canComment }: { taskId: string; comments: readonly TaskComment[]; canComment: boolean }) {
  return (
    <Panel title="Comments" headingLevel={2}>
      {comments.length === 0 ? (
        <p className="m-0 type-body-sm text-ink-muted">No comments yet.</p>
      ) : (
        <ol className="m-0 grid list-none gap-4 p-0">
          {comments.map((comment) => (
            <li key={comment.id} className="grid gap-1">
              <p className="m-0 type-label">
                {comment.authorFirstName} <span className="type-body-sm font-normal text-ink-muted">{when.format(new Date(comment.createdAt))}</span>
              </p>
              <p className="m-0 whitespace-pre-wrap break-words type-body-sm">{comment.body}</p>
            </li>
          ))}
        </ol>
      )}
      {canComment && (
        <Form<CommentField> aria-label="Add a comment" onSubmit={addTaskComment} className="gap-4">
          {({ pending, fieldErrors }) => (
            <>
              <input type="hidden" name="taskId" value={taskId} />
              <TextField label="Comment" name="body" multiline required maxLength={TASK_LIMITS.comment} error={fieldErrors.body} />
              <div>
                <Button type="submit" variant="secondary" size="sm" loading={pending}>
                  {pending ? "Sending" : "Add comment"}
                </Button>
              </div>
            </>
          )}
        </Form>
      )}
    </Panel>
  );
}
