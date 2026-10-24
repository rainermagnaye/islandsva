import type { Brand } from "@/content/brands";

/** A full-width row of client logos that drifts from right to left. The list is doubled so the loop has no gap. */
export function LogoStrip({ brands }: { brands: readonly Brand[] }) {
  if (brands.length === 0) return null;
  const loop = [...brands, ...brands];

  return (
    <section aria-label="Brands we've worked with" className="brand-marquee-wrap overflow-hidden py-8 motion-reduce:overflow-visible md:py-10">
      <ul className="brand-marquee m-0 flex w-max list-none items-center gap-12 px-6 motion-reduce:w-auto motion-reduce:flex-wrap motion-reduce:justify-center">
        {loop.map((brand, index) => {
          const clone = index >= brands.length;
          return (
            <li key={`${brand.id}-${index}`} aria-hidden={clone || undefined} className={clone ? "motion-reduce:hidden" : undefined}>
              {/* The file is already a small transparent PNG. The optimizer paints a white box behind it. */}
              {/* Lazy: an eager <img> gets a high-priority preload from React, so every logo (~1.6 MB) competed
                  with the hero on first load. width/height reserve each logo's box before it arrives. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brand.logo}
                alt={clone ? "" : brand.name}
                width={brand.width}
                height={brand.height}
                loading="lazy"
                decoding="async"
                className="h-12 w-auto max-w-40 object-contain"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
