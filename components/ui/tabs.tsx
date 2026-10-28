"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { IconName } from "@/types/icon";
import { CountBadge } from "./badge";
import { Icon } from "./icon";

export type TabItem = { id: string; label: string; content: ReactNode; icon?: IconName; count?: number; disabled?: boolean };

type TabsProps = {
  tabs: readonly TabItem[];
  /** Names the tab list. */
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** underline (default) or pill for compact filters inside panels. */
  variant?: "underline" | "pill";
  /** Sits at the end of the tab row (e.g. a Filter button for the open tab). Outside the tab list, so arrow keys skip it. */
  action?: ReactNode;
  className?: string;
};

/** The next enabled tab from `from` in `step` direction, wrapping around. */
export function nextTab(tabs: readonly Pick<TabItem, "disabled">[], from: number, step: 1 | -1) {
  for (let i = 1; i <= tabs.length; i++) {
    const index = (from + step * i + tabs.length) % tabs.length;
    if (!tabs[index].disabled) return index;
  }
  return from;
}

/**
 * Related views of one thing on one page (2–6 tabs). WAI-ARIA tabs: one tab stop, ←/→ move and activate,
 * Home/End jump. When each tab needs its own URL, render links with aria-current instead (see LeadTabs).
 */
export function Tabs({ tabs, label, value, defaultValue, onChange, variant = "underline", action, className }: TabsProps) {
  const id = useId();
  const [inner, setInner] = useState(defaultValue ?? tabs.find((tab) => !tab.disabled)?.id);
  const active = value ?? inner;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(index: number) {
    const tab = tabs[index];
    if (!tab || tab.disabled) return;
    setInner(tab.id);
    onChange?.(tab.id);
    refs.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = tabs.findIndex((tab) => tab.id === active);
    const moves: Record<string, () => number> = {
      ArrowRight: () => nextTab(tabs, current, 1),
      ArrowLeft: () => nextTab(tabs, current, -1),
      Home: () => nextTab(tabs, -1, 1),
      End: () => nextTab(tabs, tabs.length, -1),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    select(move());
  }

  return (
    <div className={cx("grid gap-4", className)}>
      <div className={cx("flex min-w-0 items-center gap-3", variant === "underline" && "border-b border-border")}>
        <div
          role="tablist"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={cx("flex min-w-0 flex-1 overflow-x-auto", variant === "underline" ? "gap-1" : "gap-1 rounded-lg bg-surface-sunken p-1")}
        >
          {tabs.map((tab, index) => {
            const selected = tab.id === active;
            return (
              <button
                key={tab.id}
                ref={(node) => {
                  refs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`${id}-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                disabled={tab.disabled}
                onClick={() => select(index)}
                className={cx(
                  "flex min-h-11 shrink-0 items-center gap-2 px-3 type-menu whitespace-nowrap disabled:cursor-not-allowed disabled:text-disabled-ink",
                  variant === "underline"
                    ? (selected ? "text-action-secondary shadow-[inset_0_-2px_0_var(--color-action-secondary)]" : "text-ink-muted hover:text-ink")
                    : cx("rounded-md", selected ? "bg-surface-card text-action-secondary elevation-sm" : "text-ink-muted hover:text-ink"),
                )}
              >
                {tab.icon && <Icon name={tab.icon} size={18} />}
                {tab.label}
                {tab.count !== undefined && <CountBadge count={tab.count} label={`${tab.count} ${tab.label}`} />}
              </button>
            );
          })}
        </div>
        {action && <div className="flex shrink-0 items-center py-1">{action}</div>}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" id={`${id}-panel-${tab.id}`} aria-labelledby={`${id}-tab-${tab.id}`} tabIndex={0} hidden={tab.id !== active}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
