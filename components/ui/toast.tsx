"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { STATUS_ICONS } from "./badge";
import { Icon } from "./icon";

export type ToastTone = "info" | "success" | "warning" | "danger";
export type ToastOptions = { title: string; description?: string; tone?: ToastTone; action?: { label: string; onClick?: () => void }; /** ms; 0 = until dismissed. Default 6000. */ duration?: number };
type ToastItem = ToastOptions & { id: string };

/** The queue rule, kept pure for tests: newest last, at most three, the oldest leaves first. */
export function pushToast(queue: readonly ToastItem[], toast: ToastItem, limit = 3) {
  return [...queue, toast].slice(-limit);
}

const ToastContext = createContext<{ show: (toast: ToastOptions) => string; dismiss: (id: string) => void } | null>(null);

const TONES: Record<ToastTone, string> = {
  info: "text-status-info",
  success: "text-status-success",
  warning: "text-status-warning",
  danger: "text-status-danger",
};

/**
 * Wrap a client subtree once, then call useToast().show() after a user's own action ("Saved", "Copied").
 * Announced politely, never steals focus, always has a close button. System problems are an Alert instead.
 */
export function ToastProvider({ children }: { children?: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const dismiss = useCallback((id: string) => setToasts((queue) => queue.filter((toast) => toast.id !== id)), []);
  const show = useCallback((toast: ToastOptions) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    setToasts((queue) => pushToast(queue, { ...toast, id }));
    return id;
  }, []);
  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext value={value}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[70] grid justify-items-stretch gap-2 sm:left-auto sm:w-96">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const { id } = toast;
  const tone = toast.tone ?? "success";
  const duration = toast.duration ?? 6000;
  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [duration, id, onDismiss]);

  return (
    <div className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-surface-card p-4 text-ink elevation-lg">
      <Icon name={STATUS_ICONS[tone]} size={20} className={cx("mt-0.5 shrink-0", TONES[tone])} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="m-0 type-label">{toast.title}</p>
        {toast.description && <p className="m-0 type-body-sm text-ink-muted">{toast.description}</p>}
        {toast.action && (
          <button
            type="button"
            className="mt-1 min-h-9 justify-self-start rounded-md px-2 type-label text-action-secondary hover:bg-action-ghost-hover"
            onClick={() => {
              toast.action?.onClick?.();
              onDismiss(id);
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button type="button" aria-label="Dismiss" onClick={() => onDismiss(id)} className="-m-2 grid size-11 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-action-ghost-hover">
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}

/** show() returns the toast's id; dismiss(id) removes it early. Must be used inside ToastProvider. */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
