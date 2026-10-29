"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { addTaskComment, deleteTaskComment, editTaskComment } from "../actions";
import { TASK_LIMITS, type CommentField } from "../contract";

export function CommentForm({ taskId, commentId, defaultValue = "", onDone }: { taskId?: string; commentId?: string; defaultValue?: string; onDone: () => void }) {
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

export function DeleteCommentDialog({ commentId, onClose }: { commentId: string; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Delete this comment?" description="This removes the comment." role="alertdialog">
      <Form
        aria-label="Delete this comment"
        onSubmit={async (formData) => {
          const result = await deleteTaskComment(formData);
          if (result.ok) onClose();
          return result;
        }}
      >
        {({ pending }) => (
          <>
            <input type="hidden" name="commentId" value={commentId} />
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Keep it
              </Button>
              <Button type="submit" variant="danger" loading={pending}>
                {pending ? "Deleting" : "Delete comment"}
              </Button>
            </div>
          </>
        )}
      </Form>
    </Modal>
  );
}
