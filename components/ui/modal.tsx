"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "./icon";

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  /** Becomes aria-labelledby. */
  title: string;
  description?: string;
  children?: ReactNode;
  /** Centered above the title. A finished action uses IconBadge here. */
  icon?: ReactNode;
  /** center = a finished result: the icon, title and actions sit on the middle axis. */
  align?: "start" | "center";
  /** Secondary/ghost first, primary last — they reverse-stack on mobile so the primary is on top. */
  footer?: ReactNode;
  /** false = no close button, Esc or scrim dismiss (required confirmations). */
  dismissible?: boolean;
  role?: "dialog" | "alertdialog";
  /** md fits a form. lg fits a file preview. */
  size?: "md" | "lg";
};

/**
 * Native <dialog> shown with showModal(): the browser provides the focus trap, Esc handling,
 * inert background and focus restore — no library needed. Bottom sheet below 640px.
 */
export function Modal({ open, onClose, title, description, children, icon, align = "start", footer, dismissible = true, role = "dialog", size = "md" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (align === "center") titleRef.current?.focus();
    else ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [open, align, title]);

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
      className={cx(
        "m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-x-hidden overflow-y-auto rounded-t-xl bg-surface-card p-0 text-ink elevation-lg [scrollbar-width:none] backdrop:bg-scrim backdrop:animate-[fade_160ms_ease] open:animate-[rise_200ms_cubic-bezier(.2,.8,.2,1)] sm:m-auto sm:rounded-xl [&::-webkit-scrollbar]:hidden",
        size === "lg" ? "sm:max-w-5xl" : "sm:max-w-[560px]",
      )}
    >
      {/* Padding lives here so a click on the dialog element itself always means the scrim. */}
      <div className={cx("p-6 sm:p-8", align === "center" && "relative")}>
        {align === "center" ? (
          <div className="grid justify-items-center gap-5 text-center">
            {icon}
            <div className="grid gap-3">
              <h2 id={titleId} ref={titleRef} tabIndex={-1} className="m-0 type-h2">
                {title}
              </h2>
              {description && (
                <p id={descId} className="m-0 text-ink-muted">
                  {description}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start gap-4">
              <h2 id={titleId} className="m-0 flex-1 type-h2">
                {title}
              </h2>
              {dismissible && <CloseButton onClose={onClose} />}
            </div>
            {description && (
              <p id={descId} className="m-0 mb-4 text-ink-muted">
                {description}
              </p>
            )}
          </>
        )}
        {align === "center" && dismissible && <CloseButton onClose={onClose} floating />}
        {children}
        {footer && (
          <div className={cx("mt-6 flex flex-col-reverse gap-3 sm:flex-row", align === "center" ? "sm:justify-center" : "sm:justify-end")}>
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}

function CloseButton({ onClose, floating = false }: { onClose?: () => void; floating?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className={cx(
        "inline-grid size-11 flex-none cursor-pointer place-items-center rounded-md text-ink hover:bg-action-ghost-hover",
        floating && "absolute top-3 right-3 sm:top-4 sm:right-4",
      )}
    >
      <Icon name="x" />
    </button>
  );
}
