import { cx } from "@/lib/cx";
import type { Tone } from "@/components/ui/tone";

// The tone's sky, sea and sun for the illustrated cover. Fill classes, so the colours follow the theme tokens.
const SCENES: Record<Tone, { sky: string; sea: string; sun: string }> = {
  lagoon: { sky: "fill-tag-lagoon-bg", sea: "fill-tag-lagoon-ink", sun: "fill-brand-sunrise" },
  coral: { sky: "fill-tag-coral-bg", sea: "fill-tag-coral-ink", sun: "fill-brand-sand" },
  sand: { sky: "fill-tag-sand-bg", sea: "fill-tag-sand-ink", sun: "fill-brand-sunrise" },
  ocean: { sky: "fill-tag-ocean-bg", sea: "fill-tag-ocean-ink", sun: "fill-brand-sand" },
};

/**
 * The illustrated island cover a post gets when it has no photo, so a grid never shows a broken image. The sun
 * rises and the waves drift when the card is hovered (transform-only, off under prefers-reduced-motion).
 */
export function IslandCover({ tone = "lagoon", className }: { tone?: Tone; className?: string }) {
  const scene = SCENES[tone];
  return (
    <svg aria-hidden="true" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className={cx("block h-full w-full", className)}>
      <rect width="320" height="180" className={scene.sky} />
      <circle cx="232" cy="78" r="26" className={cx(scene.sun, "transition-transform duration-500 group-hover:-translate-y-2 motion-reduce:transition-none")} />
      <path d="M118 120c10-26 34-38 58-36 20 2 36 16 42 36z" className="fill-brand-reef/70" />
      <path d="M160 86c2-14 8-26 16-34M176 52c-10-2-22 2-28 10m28-10c8-6 20-6 28 0m-28 0c2 10 0 20-6 28" className="fill-none stroke-brand-deep/60" strokeWidth="3" strokeLinecap="round" />
      <g className="transition-transform duration-700 group-hover:translate-x-3 motion-reduce:transition-none">
        <path d="M-20 128c40-12 80 12 120 0s80-12 120 0 80 12 120 0v60H-20z" className={cx(scene.sea, "opacity-60")} />
        <path d="M-20 146c40-10 80 10 120 0s80-10 120 0 80 10 120 0v40H-20z" className={scene.sea} />
      </g>
    </svg>
  );
}
