// Motion on hover of the surrounding `group` (the Hero's art column): waves drift apart, sun and moon ease
// away. Transforms only, 900ms; off under prefers-reduced-motion (globals.css).
const drift = "transition-[translate] duration-900 ease-[cubic-bezier(.2,.8,.2,1)]";

/**
 * The design system's day-and-night illustration: the frame splits into day (sun) and night (moon, stars)
 * under the logo's two arcs, with three wave layers and a palm island. Inline SVG so fills follow the
 * theme; decorative only. One per page (the clip-path id is fixed).
 */
export function DayNightArt() {
  return (
    <svg viewBox="0 0 480 400" aria-hidden="true" focusable="false" className="block h-auto w-full rounded-xl elevation-lg">
      <defs>
        <clipPath id="day-night-clip">
          <rect width={480} height={400} rx={24} />
        </clipPath>
      </defs>
      <g clipPath="url(#day-night-clip)">
        <rect width={240} height={400} className="fill-tag-coral-bg dark:fill-brand-sand" />
        <rect x={240} width={240} height={400} className="fill-brand-deep" />
        <circle cx={120} cy={120} r={46} className={`fill-brand-sunrise ${drift} group-hover:-translate-y-2`} />
        <path d="M392 84 a42 42 0 1 0 0 84 a34 34 0 1 1 0 -84z" className={`fill-brand-sand ${drift} group-hover:translate-y-1.5`} />
        <circle cx={300} cy={70} r={3} className="fill-brand-sand opacity-80" />
        <circle cx={440} cy={190} r={2.5} className="fill-brand-sand opacity-80" />
        <circle cx={330} cy={160} r={2} className="fill-brand-sand opacity-80" />
        <path d="M60 300 A180 180 0 0 1 240 170" className="fill-none stroke-brand-lagoon" strokeWidth={14} strokeLinecap="round" />
        <path d="M240 170 A180 180 0 0 1 420 300" className="fill-none stroke-brand-sunrise" strokeWidth={14} strokeLinecap="round" />
        <path
          d="M-40 290 Q0 274 40 290 T120 290 T200 290 T280 290 T360 290 T440 290 T520 290 T600 290 V400 H-40Z"
          className={`fill-brand-lagoon ${drift} group-hover:-translate-x-10`}
        />
        <ellipse cx={250} cy={300} rx={90} ry={20} className="fill-brand-sand" />
        <g className="fill-none stroke-brand-palm" strokeWidth={8} strokeLinecap="round">
          <path d="M250 292 Q256 252 270 222" strokeWidth={7} />
          <path d="M270 222 Q246 206 220 222" />
          <path d="M270 222 Q296 204 322 220" />
          <path d="M270 222 Q262 196 242 188" />
          <path d="M270 222 Q288 196 306 188" />
        </g>
        <path
          d="M-40 324 Q0 308 40 324 T120 324 T200 324 T280 324 T360 324 T440 324 T520 324 T600 324 V400 H-40Z"
          className={`fill-brand-reef ${drift} group-hover:translate-x-10`}
        />
        <path d="M-40 356 Q0 344 40 356 T120 356 T200 356 T280 356 T360 356 T440 356 T520 356 T600 356 V400 H-40Z" className="fill-brand-ocean" />
      </g>
    </svg>
  );
}
