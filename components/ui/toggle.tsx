"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";

type ToggleProps = {
  /** States the setting, not the action: "Night-shift coverage". */
  label: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (on: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
};

/** On/off switch for settings that apply immediately. Use Checkbox for choices submitted with a form. */
export function Toggle({ label, description, checked, defaultChecked = false, onChange, disabled, id, name, className }: ToggleProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const on = checked ?? internal;
  const switchId = id ?? `toggle-${name ?? label.toLowerCase().replace(/\W+/g, "-")}`;

  function toggle() {
    if (checked === undefined) setInternal(!on);
    onChange?.(!on);
  }

  return (
    <div className={cx("flex min-h-11 items-center justify-between gap-4", className)}>
      <label htmlFor={switchId} className="grid cursor-pointer gap-0.5">
        <span className="font-sans text-[1rem] leading-[22px] font-medium text-ink">{label}</span>
        {description && (
          <span id={`${switchId}-desc`} className="type-body-sm text-ink-muted">
            {description}
          </span>
        )}
      </label>
      <button
        type="button"
        role="switch"
        id={switchId}
        aria-checked={on}
        aria-describedby={description ? `${switchId}-desc` : undefined}
        disabled={disabled}
        onClick={toggle}
        className="forced-border group relative h-7 w-12 flex-none cursor-pointer rounded-pill border-control border-border-strong bg-surface-sunken p-0 transition-colors duration-150 aria-checked:border-action-secondary aria-checked:bg-action-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="absolute top-[3px] left-[3px] size-[19px] rounded-full bg-border-strong transition-[translate,background-color] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] group-aria-checked:translate-x-5 group-aria-checked:bg-on-action-secondary" />
      </button>
      {name && <input type="hidden" name={name} value={on ? "on" : "off"} />}
    </div>
  );
}
