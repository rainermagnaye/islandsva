"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./icon";

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  /** Becomes aria-labelledby. */
  title: string;
  description?: string;
  children?: ReactNode;
  /** Secondary/ghost first, primary last — they reverse-stack on mobile so the primary is on top. */
  footer?: ReactNode;
  /** false = no close button, Esc or scrim dismiss (required confirmations). */
  dismissible?: boolean;
  role?: "dialog" | "alertdialog";
};

/**
 * Native <dialog> shown with showModal(): the browser provides the focus trap, Esc handling,
 * inert background and focus restore — no library needed. Bottom sheet below 640px.
 */
export function Modal({ open, onClose, title, description, children, footer, dismissible = true, role = "dialog" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose?.();
      }}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose?.();
      }}
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-auto rounded-t-xl bg-surface-card p-0 text-ink elevation-lg backdrop:bg-scrim backdrop:animate-[fade_160ms_ease] open:animate-[rise_200ms_cubic-bezier(.2,.8,.2,1)] sm:m-auto sm:max-w-[560px] sm:rounded-xl"
    >
      {/* Padding lives here so a click on the dialog element itself always means the scrim. */}
      <div className="p-6 sm:p-8">
        <div className="mb-4 flex items-start gap-4">
          <h2 id={titleId} className="m-0 flex-1 type-h2">
            {title}
          </h2>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-grid size-11 flex-none cursor-pointer place-items-center rounded-md text-ink hover:bg-action-ghost-hover"
            >
              <Icon name="x" />
            </button>
          )}
        </div>
        {description && (
          <p id={descId} className="m-0 mb-4 text-ink-muted">
            {description}
          </p>
        )}
        <div>{children}</div>
        {footer && <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </dialog>
  );
}
