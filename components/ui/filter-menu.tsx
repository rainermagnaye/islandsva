"use client";

import { useRef } from "react";
import { cx } from "@/lib/cx";
import { buttonClasses } from "./button";
import { cardSurface } from "./card";
import { Icon } from "./icon";

type FilterOption<T extends string> = { value: T; label: string };

type FilterMenuProps<T extends string> = {
  options: readonly FilterOption<T>[];
  /** The chosen value; undefined = the "All" option. */
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  label?: string;
  allLabel?: string;
};

/**
 * A ghost button that opens a short list of filter choices — a native `<details>`, so it opens from the
 * keyboard without extra script. Choosing one closes it.
 */
export function FilterMenu<T extends string>({ options, value, onChange, label = "Filter", allLabel = "All" }: FilterMenuProps<T>) {
  const ref = useRef<HTMLDetailsElement>(null);

  function choose(next: T | undefined) {
    onChange(next);
    if (ref.current) ref.current.open = false;
  }

  const choices: { value: T | undefined; label: string }[] = [{ value: undefined, label: allLabel }, ...options];

  return (
    <details ref={ref} className="relative">
      <summary
        className={buttonClasses({
          variant: "ghost",
          className: "cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden",
        })}
      >
        <Icon name="filter" />
        {label}
      </summary>
      <ul className={cx(cardSurface, "absolute left-0 z-10 m-0 mt-2 grid min-w-44 list-none gap-1 p-2 elevation-md lg:right-0 lg:left-auto")}>
        {choices.map((choice) => (
          <li key={choice.value ?? ""}>
            <button
              type="button"
              onClick={() => choose(choice.value)}
              aria-pressed={value === choice.value}
              className={cx(
                "flex min-h-9 w-full cursor-pointer items-center rounded-md px-3 text-left type-label",
                value === choice.value ? "bg-surface-sunken text-action-secondary" : "text-ink hover:bg-action-ghost-hover",
              )}
            >
              {choice.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
