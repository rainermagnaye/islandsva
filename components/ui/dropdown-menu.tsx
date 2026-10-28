"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "@/lib/cx";
import type { IconName } from "@/types/icon";
import { Icon } from "./icon";

export type MenuItem =
  | { separator: true }
  | { separator?: false; label: string; icon?: IconName; onSelect?: () => void; hint?: string; danger?: boolean; disabled?: boolean };

type DropdownMenuProps = {
  /** Button text, or its accessible name with iconOnly. */
  label: string;
  items: readonly MenuItem[];
  icon?: IconName;
  iconOnly?: boolean;
  /** end for triggers at a right edge. */
  align?: "start" | "end";
  className?: string;
};

/**
 * A button that opens a short list of actions (row actions, "More"). Menu-button pattern: ↓/Enter/Space open
 * and focus the first item, ↑/↓ Home/End move, Escape or a click outside close and return focus. Actions only:
 * a value is a Select, navigation is links. Destructive items go last, behind a confirmation Modal.
 */
export function DropdownMenu({ label, items, icon = "more", iconOnly = false, align = "start", className }: DropdownMenuProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const enabled = () => Array.from(list.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? []);
  const focusItem = (index: number) => {
    const all = enabled();
    all[(index + all.length) % all.length]?.focus();
  };

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  function onMenuKey(event: KeyboardEvent<HTMLUListElement>) {
    const all = enabled();
    const index = all.indexOf(document.activeElement as HTMLButtonElement);
    const keys: Record<string, () => void> = {
      ArrowDown: () => focusItem(index + 1),
      ArrowUp: () => focusItem(index - 1),
      Home: () => focusItem(0),
      End: () => focusItem(all.length - 1),
      Escape: close,
      Tab: () => setOpen(false),
    };
    if (!keys[event.key]) return;
    if (event.key !== "Tab") event.preventDefault();
    keys[event.key]();
  }

  return (
    <div ref={root} className={cx("relative inline-block", className)}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        aria-label={iconOnly ? label : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cx(
          "inline-flex min-h-11 items-center gap-2 rounded-md type-button text-ink hover:bg-action-ghost-hover",
          iconOnly ? "size-11 justify-center border-control border-border-strong" : "border-control border-border-strong px-3",
        )}
      >
        <Icon name={icon} size={20} />
        {!iconOnly && label}
        {!iconOnly && <Icon name="chevron-down" size={16} />}
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-menu`}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className={cx("absolute z-50 m-0 mt-1 grid min-w-48 list-none gap-0.5 rounded-lg border border-border bg-surface-card p-1 elevation-md", align === "end" ? "right-0" : "left-0")}
        >
          {items.map((item, index) =>
            item.separator ? (
              <li key={`sep-${index}`} role="separator" className="my-1 h-px bg-border" />
            ) : (
              <li key={item.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={item.disabled}
                  onClick={() => {
                    item.onSelect?.();
                    close();
                  }}
                  className={cx(
                    "flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left type-body-sm hover:bg-action-ghost-hover focus-visible:bg-action-ghost-hover disabled:cursor-not-allowed disabled:text-disabled-ink",
                    item.danger ? "text-status-danger" : "text-ink",
                  )}
                >
                  {item.icon && <Icon name={item.icon} size={18} />}
                  <span className="flex-1">{item.label}</span>
                  {item.hint && <span className="type-caption text-ink-muted">{item.hint}</span>}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
