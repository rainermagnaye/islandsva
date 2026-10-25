"use client";

import { cloneElement, useId, useState, type ReactElement } from "react";
import { cx } from "@/lib/cx";

type TooltipProps = {
  /** Plain text, under ~80 characters. Never links, buttons or essential instructions. */
  content: string;
  /** One focusable element, usually an icon button that still has its own aria-label. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  side?: "top" | "bottom";
  className?: string;
};

/** A short dark label for an icon button or a metric: on hover and on keyboard focus, closed by Escape. */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cx("relative inline-flex", className)}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      {cloneElement(children, { "aria-describedby": id })}
      <span
        role="tooltip"
        id={id}
        hidden={!open}
        className={cx(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-64 -translate-x-1/2 rounded-md bg-surface-inverse px-2.5 py-1.5 type-body-sm text-ink-inverse elevation-md",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {content}
      </span>
    </span>
  );
}
