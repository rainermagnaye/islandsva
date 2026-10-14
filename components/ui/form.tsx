"use client";

import { startTransition, useActionState, useEffect, useEffectEvent, useRef, type FormEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { SubmitResult } from "@/types/form";
import { Alert } from "./alert";
import { cardSurface } from "./card";
import { IconBadge } from "./icon-badge";

export type FormState<Field extends string = string> = {
  pending: boolean;
  fieldErrors: Partial<Record<Field, string>>;
};

type FormProps<Field extends string> = {
  /** Receives the form's FormData; returns the outcome. Never throws — map failures to `{ ok: false }`. */
  onSubmit: (formData: FormData) => Promise<SubmitResult<Field>>;
  /** Fields and buttons. A function receives `{ pending, fieldErrors }` to wire errors and the submit button's `loading`. */
  children: ReactNode | ((state: FormState<Field>) => ReactNode);
  /** Replaces the form after a successful submit (announced to screen readers). Omit to keep the form on screen. */
  success?: ReactNode;
  /** Runs after every failed submit, e.g. to reset a single-use captcha token. */
  onError?: (result: Extract<SubmitResult<Field>, { ok: false }>) => void;
  className?: string;
  id?: string;
  "aria-label"?: string;
};

/**
 * Generic client-side form: pending state, error summary, focus management and success state.
 *
 * - Submits via a transition instead of `<form action>`, because React resets every field after a
 *   form action — even when the request fails — which would wipe what the user typed.
 * - Native validation (`required`, `type="email"`, `maxLength`) runs first; `onSubmit` only sees forms
 *   that pass it. The server must still validate everything.
 * - On failure, focus moves to the first field (in DOM order) with an error, otherwise to the summary.
 */
export function Form<Field extends string = string>({
  onSubmit,
  children,
  success,
  onError,
  className,
  id,
  "aria-label": ariaLabel,
}: FormProps<Field>) {
  const [result, dispatch, pending] = useActionState<SubmitResult<Field> | null, FormData>(
    (_previous, formData) => onSubmit(formData),
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const notifyError = useEffectEvent((failed: Extract<SubmitResult<Field>, { ok: false }>) => onError?.(failed));

  const failure = result && !result.ok ? result : null;
  const fieldErrors = (failure?.fieldErrors ?? {}) as Partial<Record<Field, string>>;

  useEffect(() => {
    if (!failure) return;
    const errors: Partial<Record<string, string>> = failure.fieldErrors ?? {};
    const firstInvalid = Array.from(formRef.current?.elements ?? []).find(
      (el) => el instanceof HTMLElement && errors[(el as HTMLInputElement).name],
    ) as HTMLElement | undefined;
    (firstInvalid ?? summaryRef.current)?.focus();
    notifyError(failure);
  }, [failure]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  if (result?.ok && success) {
    return <div role="status">{success}</div>;
  }

  return (
    // method="post": if someone submits before JavaScript loads, the browser posts instead of the default
    // GET, so field values (names, emails) never end up in the URL, history or server logs.
    <form
      ref={formRef}
      id={id}
      method="post"
      onSubmit={handleSubmit}
      aria-label={ariaLabel}
      aria-busy={pending || undefined}
      className={cx("grid gap-5", className)}
    >
      {failure && <Alert ref={summaryRef} tabIndex={-1} tone="danger" title={failure.message} />}
      {typeof children === "function" ? children({ pending, fieldErrors }) : children}
    </form>
  );
}

/** Standard success panel for `<Form success={…}>`. */
export function FormSuccess({ title, children, align = "start" }: { title: string; children?: ReactNode; align?: "start" | "center" }) {
  return (
    <div className={cx(cardSurface, "grid gap-4 p-8", align === "center" ? "justify-items-center text-center" : "justify-items-start")}>
      <IconBadge name="check" tone="success" />
      <h2 className="m-0 type-h3">{title}</h2>
      {children && <div className="text-ink-muted">{children}</div>}
    </div>
  );
}
