"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { Tone } from "@/components/ui/tone";
import { cx } from "@/lib/cx";

export type BlogComment = { id: string; author: string; avatar?: string; tone?: Tone; isAuthor?: boolean; role?: string; date: string; dateTime?: string; body: string; replies?: readonly BlogComment[] };

type CommentThreadProps = {
  comments: readonly BlogComment[];
  /** Called with the text and the parent id (null at top level). Persist, rate-limit and moderate on the server. */
  onSubmit?: (text: string, parentId: string | null) => void;
  formLabel?: string;
  formHint?: string;
  submitLabel?: string;
  className?: string;
};

const count = (comments: readonly BlogComment[]): number => comments.reduce((sum, c) => sum + 1 + count(c.replies ?? []), 0);

/**
 * A calm comment section: speech-bubble comments, an "Author" badge, one level of replies and a form to add
 * your own. Bodies render as text, never HTML. Success is announced politely; an empty submit is an inline error.
 */
export function CommentThread({ comments, onSubmit, formLabel = "Add a comment", formHint, submitLabel = "Post comment", className }: CommentThreadProps) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const total = count(comments);

  function submit(text: string, parentId: string | null) {
    onSubmit?.(text, parentId);
    setReplyTo(null);
    setAnnouncement(parentId ? "Reply posted." : "Comment posted.");
  }

  return (
    <section aria-labelledby="comments-title" className={cx("grid gap-6", className)}>
      <h2 id="comments-title" className="m-0 type-h3 text-ink">
        {total === 1 ? "1 comment" : `${total} comments`}
      </h2>
      <ol className="m-0 grid list-none gap-6 p-0">
        {comments.map((comment) => (
          <li key={comment.id} className="grid gap-4">
            <Comment comment={comment} replying={replyTo === comment.id} onReply={() => setReplyTo(replyTo === comment.id ? null : comment.id)} />
            {replyTo === comment.id && <CommentForm label={`Reply to ${comment.author}`} submitLabel="Post reply" autoFocus onSubmit={(text) => submit(text, comment.id)} className="sm:ml-12" />}
            {comment.replies && comment.replies.length > 0 && (
              <ol className="m-0 grid list-none gap-4 p-0 sm:ml-6">
                {comment.replies.map((reply) => (
                  <li key={reply.id}>
                    <Comment comment={reply} />
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
      <CommentForm label={formLabel} hint={formHint} submitLabel={submitLabel} onSubmit={(text) => submit(text, null)} />
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}

function Comment({ comment, replying, onReply }: { comment: BlogComment; replying?: boolean; onReply?: () => void }) {
  return (
    <article aria-label={`Comment by ${comment.author}`} className="flex gap-3">
      <Avatar name={comment.author} src={comment.avatar} tone={comment.isAuthor ? "coral" : comment.tone} />
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="grid gap-1 rounded-lg rounded-tl-none border border-border bg-surface-card p-4">
          <p className="m-0 flex flex-wrap items-center gap-2 type-body-sm">
            <span className="font-semibold text-ink">{comment.author}</span>
            {comment.isAuthor && (
              <Badge tone="brand" size="sm" icon={null}>
                Author
              </Badge>
            )}
            {comment.role && <span className="text-ink-muted">{comment.role}</span>}
            <time dateTime={comment.dateTime} className="text-ink-muted">
              {comment.date}
            </time>
          </p>
          <p className="m-0 type-body whitespace-pre-line text-ink">{comment.body}</p>
        </div>
        {onReply && (
          <button type="button" aria-expanded={replying} onClick={onReply} className="inline-flex min-h-11 items-center gap-1.5 justify-self-start rounded-md px-2 type-label text-action-secondary hover:bg-action-ghost-hover">
            <Icon name="message" size={16} />
            Reply<span className="sr-only"> to {comment.author}</span>
          </button>
        )}
      </div>
    </article>
  );
}

function CommentForm({ label, hint, submitLabel, autoFocus, onSubmit, className }: { label: string; hint?: string; submitLabel: string; autoFocus?: boolean; onSubmit: (text: string) => void; className?: string }) {
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = field.current?.value.trim() ?? "";
    if (!text) {
      setError("Write a comment before posting.");
      field.current?.focus();
      return;
    }
    setError(null);
    onSubmit(text);
    if (field.current) field.current.value = "";
  }

  return (
    <form onSubmit={handle} noValidate className={cx("grid gap-3 rounded-lg bg-surface-sunken p-5", className)}>
      <label htmlFor={id} className="type-label text-ink">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="m-0 type-body-sm text-ink-muted">
          {hint}
        </p>
      )}
      <textarea
        ref={field}
        id={id}
        rows={4}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined}
        className="min-h-24 w-full rounded-md border-control border-border-strong bg-surface-card px-3 py-2.5 type-body text-ink aria-invalid:border-2 aria-invalid:border-status-danger"
      />
      {error && (
        <p id={`${id}-error`} className="m-0 flex items-center gap-1 type-label text-status-danger">
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}
      <div>
        <Button type="submit" variant="secondary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
