/**
 * Names of the design-system outline icons. Lives in types/ so content and UI can both use it;
 * `components/ui/icon.tsx` must draw exactly these (enforced there with `satisfies`).
 */
export type IconName =
  | "menu"
  | "x"
  | "check"
  | "chevron-down"
  | "arrow-right"
  | "plus"
  | "alert"
  | "sun"
  | "moon"
  | "calendar"
  | "inbox"
  | "user"
  | "users"
  | "chart"
  | "sliders"
  | "home"
  | "briefcase"
  | "headset"
  | "message"
  | "shield"
  | "clock"
  | "search"
  | "bell"
  | "log-out"
  | "file";
