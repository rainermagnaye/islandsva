import { cx } from "@/lib/cx";

/**
 * A decorative two-layer lagoon/reef wave between sections, full width and 48px tall. `flip` turns it over for a
 * section's top edge. At most two per page.
 */
export function WaveDivider({ flip = false, className }: { flip?: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 1200 48" preserveAspectRatio="none" className={cx("pointer-events-none block h-12 w-full", flip && "rotate-180", className)}>
      <path d="M0 22c160-18 320 16 480 0s320-16 480 0 240 16 240 0v26H0z" className="fill-brand-lagoon/50" />
      <path d="M0 32c160-12 320 12 480 0s320-12 480 0 240 12 240 0v16H0z" className="fill-brand-reef/60" />
    </svg>
  );
}
