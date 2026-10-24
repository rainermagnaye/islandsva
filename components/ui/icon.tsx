import { cx } from "@/lib/cx";
import type { IconName } from "@/types/icon";

type IconProps = {
  name: IconName;
  /** Accessible name. Omit for decorative icons (aria-hidden). */
  label?: string;
  size?: number;
  className?: string;
};

/** Draws a symbol from <IconSprite> (root layout). The shapes live there, so this stays tiny in client bundles. */
export function Icon({ name, label, size = 20, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("flex-none", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <use href={`#icon-${name}`} />
    </svg>
  );
}
