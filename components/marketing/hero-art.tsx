/**
 * Hero illustration built from the logo's shapes (arcs, sun, moon, palm, island) in brand hues, per the
 * design system's illustration rules. Inline SVG so fills follow the theme; decorative only.
 */
export function HeroArt() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[440px]">
      <svg viewBox="0 0 400 400" className="block w-full" fill="none" strokeLinecap="round">
        <circle cx="200" cy="200" r="168" className="fill-surface-sunken" />
        <path d="M150 52a156 156 0 0 0 0 296" className="stroke-brand-lagoon" strokeWidth="16" />
        <path d="M250 52a156 156 0 0 1 0 296" className="stroke-brand-sunrise" strokeWidth="16" />
        <circle cx="200" cy="44" r="20" className="fill-brand-sun" />
        <path d="M214 344a20 20 0 1 1-22-30 16 16 0 0 0 22 30z" className="fill-brand-reef" />
        <path d="M118 296c40-26 124-26 164 0z" className="fill-ink" />
        <path d="M203 292c-6-50-8-96 2-140" className="stroke-ink" strokeWidth="10" />
        <g className="stroke-brand-palm" strokeWidth="11">
          <path d="M205 152c-22-22-52-26-80-12" />
          <path d="M205 152c-28-4-50 10-62 34" />
          <path d="M205 152c22-24 54-26 80-10" />
          <path d="M205 152c28-2 50 14 60 38" />
          <path d="M205 152c-4-22 4-40 22-52" />
        </g>
      </svg>
      <div className="absolute top-[18%] -left-2 flex items-center gap-2 rounded-pill border border-border bg-surface-card px-3 py-2 type-label elevation-md sm:-left-6">
        <span className="size-2 rounded-full bg-status-success" />
        Inbox cleared · 7:58 am
      </div>
      <div className="absolute right-0 bottom-[16%] flex items-center gap-2 rounded-pill border border-border bg-surface-card px-3 py-2 type-label elevation-md sm:-right-4">
        <span className="size-2 rounded-full bg-brand-sun" />
        Night shift online
      </div>
    </div>
  );
}
