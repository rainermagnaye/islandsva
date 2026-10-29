import { cx } from "@/lib/cx";
import { TONE_CLASSES, type Tone } from "./tone";

const SIZES = { sm: "size-7 type-caption", md: "size-10 type-label", lg: "size-16 type-h4" } as const;

/** Up to two initials: "Lia Santos" → "LS". */
export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/**
 * A round photo, or the person's initials on their tone. Always decorative: the name is printed beside it, so
 * screen readers hear it once.
 */
export function Avatar({ name, src, tone = "lagoon", size = "md", className }: { name: string; src?: string; tone?: Tone; size?: keyof typeof SIZES; className?: string }) {
  const classes = cx("inline-grid shrink-0 place-items-center overflow-hidden rounded-pill font-semibold", SIZES[size], className);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- a small decorative photo; next/image would add client JS
    return <img src={src} alt="" aria-hidden="true" className={cx(classes, "object-cover")} />;
  }
  return (
    <span aria-hidden="true" className={cx(classes, TONE_CLASSES[tone].bg, TONE_CLASSES[tone].ink)}>
      {initialsOf(name)}
    </span>
  );
}
