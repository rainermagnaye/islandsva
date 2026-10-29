"use client";

import { lazy, Suspense, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import type { TaskComment } from "../contract";

const CommentForm = lazy(() => import("./task-comment-form").then((m) => ({ default: m.CommentForm })));
const DeleteCommentDialog = lazy(() => import("./task-comment-form").then((m) => ({ default: m.DeleteCommentDialog })));

/**
 * The conversation on the task. The composer loads when someone writes or edits, so the task page doesn't
 * ship the form on first load. Status moves and their notes live in the activity, not here.
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
  const [adding, setAdding] = useState(false);
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
                    <Suspense fallback={null}>
                      <CommentForm commentId={comment.id} defaultValue={comment.body} onDone={() => setEditingId(null)} />
                    </Suspense>
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
          {adding ? (
            <Suspense fallback={null}>
              <CommentForm
                key={draft}
                taskId={taskId}
                onDone={() => setDraft((n) => n + 1)}
              />
            </Suspense>
          ) : (
            <Button type="button" variant="secondary" size="sm" iconLeft="plus" onClick={() => setAdding(true)}>
              Add a comment
            </Button>
          )}
        </div>
      )}
      {deletingId && (
        <Suspense fallback={null}>
          <DeleteCommentDialog commentId={deletingId} onClose={() => setDeletingId(null)} />
        </Suspense>
      )}
    </Card>
  );
}
