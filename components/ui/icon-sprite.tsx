import "server-only";
import type { IconName } from "@/types/icon";

type Shape = ["p", string] | ["c", number, number, number] | ["r", number, number, number, number, number];

// Outline set from the design system: 24px grid, 1.75px rounded stroke, currentColor.
// Drawn here, once per page, as <symbol>s that <Icon> references with <use>: the shapes ship in the HTML,
// not in every client bundle that renders a Button or an Icon (~1 KB gzipped of JS per page).
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
  info: [["c", 12, 12, 9], ["p", "M12 11v5.5M12 7.8v.2"]],
  "check-circle": [["c", 12, 12, 9], ["p", "M8 12.5l2.7 2.7L16 9.8"]],
  "alert-triangle": [["p", "M12 3.5L2.5 20h19zM12 10v4.5M12 17.2v.3"]],
  "x-circle": [["c", 12, 12, 9], ["p", "M9 9l6 6M15 9l-6 6"]],
  "chevron-left": [["p", "M15 6l-6 6 6 6"]],
  "chevron-right": [["p", "M9 6l6 6-6 6"]],
  "chevron-up": [["p", "M6 15l6-6 6 6"]],
  chevrons: [["p", "M8 9l4-4 4 4M8 15l4 4 4-4"]],
  "arrow-up": [["p", "M12 19V5M6 11l6-6 6 6"]],
  "arrow-down": [["p", "M12 5v14M6 13l6 6 6-6"]],
  star: [["p", "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"]],
  more: [["c", 5, 12, 1.2], ["c", 12, 12, 1.2], ["c", 19, 12, 1.2]],
  mail: [["r", 3, 5, 18, 14, 2], ["p", "M3.5 6.5l8.5 6.5 8.5-6.5"]],
  phone: [["p", "M5 4h3.5l1.5 4.5-2 1.5a11 11 0 0 0 6 6l1.5-2 4.5 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"]],
  "map-pin": [["p", "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"], ["c", 12, 9.5, 2.5]],
  globe: [["c", 12, 12, 9], ["p", "M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"]],
  edit: [["p", "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"]],
  trash: [["p", "M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6"]],
  copy: [["r", 8, 8, 12, 12, 2], ["p", "M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"]],
  filter: [["p", "M4 5h16l-6 7.5V19l-4 1.5v-8z"]],
  download: [["p", "M12 4v11M7 10l5 5 5-5M5 20h14"]],
  external: [["p", "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"]],
} satisfies Record<IconName, Shape[]>;

/** Rendered once by the root layout. Stroke and colour come from each <Icon>'s <svg> through <use>. */
export function IconSprite() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" className="absolute overflow-hidden">
      {(Object.entries(ICONS) as [IconName, Shape[]][]).map(([name, shapes]) => (
        <symbol key={name} id={`icon-${name}`} viewBox="0 0 24 24">
          {shapes.map((s, i) =>
            s[0] === "p" ? (
              <path key={i} d={s[1]} />
            ) : s[0] === "c" ? (
              <circle key={i} cx={s[1]} cy={s[2]} r={s[3]} />
            ) : (
              <rect key={i} x={s[1]} y={s[2]} width={s[3]} height={s[4]} rx={s[5]} />
            ),
          )}
        </symbol>
      ))}
    </svg>
  );
}
