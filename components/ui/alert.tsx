import type { ReactNode, Ref } from "react";
import { cx } from "@/lib/cx";
import { STATUS_ICONS } from "./badge";
import { Icon } from "./icon";

type AlertTone = keyof typeof STATUS_ICONS;

const tones: Record<AlertTone, string> = {
  info: "border-status-info bg-status-info-bg [--alert-ink:var(--status-info)]",
  success: "border-status-success bg-status-success-bg [--alert-ink:var(--status-success)]",
  warning: "border-status-warning bg-status-warning-bg [--alert-ink:var(--status-warning)]",
  danger: "border-status-danger bg-status-danger-bg [--alert-ink:var(--status-danger)]",
};

/** Read before the title by screen readers, so the tone never rests on colour alone. */
const WORDS: Record<AlertTone, string> = { info: "Note", success: "Success", warning: "Warning", danger: "Error" };

type AlertProps = {
  tone?: AlertTone;
  /** One line: what happened. */
  title: ReactNode;
  /** Optional: what to do about it. */
  children?: ReactNode;
  /** Optional small Button(s). */
  action?: ReactNode;
  /** -1 lets a form move focus here after a failed submit. */
  tabIndex?: number;
  ref?: Ref<HTMLDivElement>;
  className?: string;
};

/**
 * An inline message that stays until the state it describes is resolved. Danger and warning are
 * announced immediately (role="alert"); info and success politely (role="status"). For a quick
 * confirmation of the user's own action, a toast fits better.
 */
export function Alert({ tone = "info", title, children, action, tabIndex, ref, className }: AlertProps) {
  return (
    <div
      ref={ref}
      tabIndex={tabIndex}
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cx("grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-lg border p-4 text-ink", tones[tone], className)}
    >
      <Icon name={STATUS_ICONS[tone]} size={22} className="mt-px text-(--alert-ink)" />
      <div className="grid min-w-0 gap-1">
        <p className="m-0 font-sans text-base leading-[1.375rem] font-semibold">
          <span className="sr-only">{WORDS[tone]}: </span>
          {title}
        </p>
        {children && <div className="text-[0.9375rem] leading-[1.375rem] [&_p]:m-0">{children}</div>}
        {action && <div className="mt-2 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}
