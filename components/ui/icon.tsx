import { cx } from "@/lib/cx";
import type { IconName } from "@/types/icon";

type Shape = ["p", string] | ["c", number, number, number] | ["r", number, number, number, number, number];

// Outline set from the design system: 24px grid, 1.75px rounded stroke, currentColor.
const ICONS = {
  menu: [["p", "M4 6h16M4 12h16M4 18h16"]],
  x: [["p", "M6 6l12 12M18 6L6 18"]],
  check: [["p", "M5 12.5l4.5 4.5L19 7"]],
  "chevron-down": [["p", "M6 9l6 6 6-6"]],
  "arrow-right": [["p", "M5 12h14M13 6l6 6-6 6"]],
  plus: [["p", "M12 5v14M5 12h14"]],
  alert: [["c", 12, 12, 9], ["p", "M12 7.5v5M12 16.2v.3"]],
  sun: [["c", 12, 12, 4], ["p", "M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"]],
  moon: [["p", "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"]],
  calendar: [["r", 3, 5, 18, 16, 2], ["p", "M3 10h18M8 3v4M16 3v4"]],
  inbox: [["p", "M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 13h5l1.5 3h5L16 13h5"]],
  user: [["c", 12, 8, 4], ["p", "M4.5 20.5a7.5 7.5 0 0 1 15 0"]],
  users: [["c", 9, 8, 3.5], ["p", "M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a5.5 5.5 0 0 1 3.5 5.5"]],
  chart: [["p", "M3 20h18M6 20v-8M11 20V5M16 20v-11"]],
  sliders: [["p", "M4 7h9M17 7h3M4 17h3M11 17h9"], ["c", 15, 7, 2], ["c", 9, 17, 2]],
  home: [["p", "M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5"]],
  briefcase: [["r", 3, 7, 18, 13, 2], ["p", "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"]],
  headset: [["p", "M4 15v-3a8 8 0 0 1 16 0v3"], ["r", 3, 14, 4, 6, 1.5], ["r", 17, 14, 4, 6, 1.5]],
  message: [["p", "M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z"]],
  shield: [["p", "M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"], ["p", "M9 12l2 2 4-4"]],
  clock: [["c", 12, 12, 9], ["p", "M12 7v5l3.5 2"]],
  search: [["c", 11, 11, 6.5], ["p", "M16 16l4.5 4.5"]],
  bell: [["p", "M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"]],
  "log-out": [["p", "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10"]],
  file: [["p", "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"]],
} satisfies Record<IconName, Shape[]>;

type IconProps = {
  name: IconName;
  /** Accessible name. Omit for decorative icons (aria-hidden). */
  label?: string;
  size?: number;
  className?: string;
};

export function Icon({ name, label, size = 20, className }: IconProps) {
  const shapes: Shape[] = ICONS[name];
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
      {shapes.map((s, i) =>
        s[0] === "p" ? (
          <path key={i} d={s[1]} />
        ) : s[0] === "c" ? (
          <circle key={i} cx={s[1]} cy={s[2]} r={s[3]} />
        ) : (
          <rect key={i} x={s[1]} y={s[2]} width={s[3]} height={s[4]} rx={s[5]} />
        ),
      )}
    </svg>
  );
}
