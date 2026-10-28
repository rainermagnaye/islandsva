"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { addTaskComment, deleteTaskComment, editTaskComment } from "../actions";
import { TASK_LIMITS, type CommentField, type TaskComment } from "../contract";

/**
 * The conversation on the task. The add form stays open under the list; the author edits or deletes from the
 * menu. Status moves and their notes live in the activity, not here.
 */
export function TaskComments({
  taskId,
  comments,
  canComment,
  viewerId,
  timeZone,
  empty,
}: {
  taskId: string;
  comments: readonly TaskComment[];
  canComment: boolean;
  viewerId: string;
  timeZone: string;
  empty: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(0);
  const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });

  return (
    <Card as="section" aria-labelledby="task-comments" className="grid gap-4">
      <h2 id="task-comments" className="m-0 type-h4">
        Comments <span className="font-medium text-ink-muted">· {comments.length}</span>
      </h2>
      {comments.length === 0 ? (
        <p className="m-0 type-body-sm text-ink-muted">{empty}</p>
      ) : (
        <ol className="m-0 grid list-none gap-4 p-0">
          {comments.map((comment) => {
            const mine = comment.authorId === viewerId;
            const name = mine ? "You" : comment.authorFirstName;
            return (
              <li key={comment.id} className="flex items-start gap-3">
                <Avatar name={comment.authorFirstName} tone={mine ? "sand" : "lagoon"} size="sm" />
                {editingId === comment.id ? (
                  <div className="min-w-0 flex-1">
                    <CommentForm commentId={comment.id} defaultValue={comment.body} onDone={() => setEditingId(null)} />
                  </div>
                ) : (
                  <>
                    <div className="grid min-w-0 flex-1 gap-1">
                      <p className="m-0 type-body-sm">
                        <strong>{name}</strong> <span className="text-ink-muted">· {when.format(new Date(comment.createdAt))}</span>
                      </p>
                      <p className="m-0 whitespace-pre-wrap break-words type-body">{comment.body}</p>
                    </div>
                    {mine && (
                      <DropdownMenu
                        label="Comment actions"
                        icon="more"
                        iconOnly
                        align="end"
                        items={[
                          { label: "Edit", icon: "edit", onSelect: () => setEditingId(comment.id) },
                          { label: "Delete", icon: "trash", danger: true, onSelect: () => setDeletingId(comment.id) },
                        ]}
                      />
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {canComment && (
        <div className="border-t border-border pt-4">
          {/* A new key clears the field after a post, without controlling the textarea. */}
          <CommentForm key={draft} taskId={taskId} onDone={() => setDraft((n) => n + 1)} />
        </div>
      )}
      <Modal open={deletingId !== null} onClose={() => setDeletingId(null)} title="Delete this comment?" description="This removes the comment." role="alertdialog">
        {deletingId && (
          <Form
            aria-label="Delete this comment"
            onSubmit={async (formData) => {
              const result = await deleteTaskComment(formData);
              if (result.ok) setDeletingId(null);
              return result;
            }}
          >
            {({ pending }) => (
              <>
                <input type="hidden" name="commentId" value={deletingId} />
                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                  <Button type="button" variant="ghost" onClick={() => setDeletingId(null)} disabled={pending}>
                    Keep it
                  </Button>
                  <Button type="submit" variant="danger" loading={pending}>
                    {pending ? "Deleting" : "Delete comment"}
                  </Button>
                </div>
              </>
            )}
          </Form>
        )}
      </Modal>
    </Card>
  );
}

function CommentForm({ taskId, commentId, defaultValue = "", onDone }: { taskId?: string; commentId?: string; defaultValue?: string; onDone: () => void }) {
  const editing = commentId !== undefined;
  return (
    <Form<CommentField>
      aria-label={editing ? "Edit comment" : "Add a comment"}
      onSubmit={async (formData) => {
        const result = editing ? await editTaskComment(formData) : await addTaskComment(formData);
        if (result.ok) onDone();
        return result;
      }}
      className="gap-3"
    >
      {({ pending, fieldErrors }) => (
        <>
          {taskId && <input type="hidden" name="taskId" value={taskId} />}
          {commentId && <input type="hidden" name="commentId" value={commentId} />}
          <TextField
            label={editing ? "Comment" : "Add a comment"}
            id={editing ? `comment-${commentId}` : "field-new-comment"}
            name="body"
            multiline
            rows={3}
            required
            maxLength={TASK_LIMITS.comment}
            defaultValue={defaultValue}
            error={fieldErrors.body}
          />
          <div className="flex justify-end gap-3">
            {editing && (
              <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>
                Cancel
              </Button>
            )}
            <Button type="submit" variant="secondary" size={editing ? "sm" : "md"} loading={pending}>
              {pending ? "Saving" : editing ? "Save comment" : "Post comment"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
