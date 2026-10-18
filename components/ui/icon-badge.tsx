import { cx } from "@/lib/cx";
import type { IconName } from "@/types/icon";
import { Icon } from "./icon";

const sizes = {
  md: { box: "size-12", icon: 24 },
  lg: { box: "size-16", icon: 32 },
  /** The mark above a centered modal result. */
  xl: { box: "size-24", icon: 48 },
} as const;

const tones = {
  info: "bg-status-info-bg text-action-secondary",
  success: "bg-status-success-bg text-status-success",
  danger: "bg-status-danger-bg text-status-danger",
} as const;

type IconBadgeProps = {
  name: IconName;
  /** md = cards and lists; lg = full-page status panels; xl = a centered modal result. */
  size?: keyof typeof sizes;
  tone?: keyof typeof tones;
  className?: string;
};

/** Icon in a tinted circle — the design system's marker for features, services and status. Decorative. */
export function IconBadge({ name, size = "md", tone = "info", className }: IconBadgeProps) {
  return (
    <span className={cx("grid place-items-center rounded-pill", sizes[size].box, tones[tone], className)}>
      <Icon name={name} size={sizes[size].icon} />
    </span>
  );
}
