import { getImageProps } from "next/image";
import Link from "next/link";
import { routes } from "@/content/routes";
import { site } from "@/content/site";
import { cx } from "@/lib/cx";

// Lockup PNGs are 938×320, shown at 40px tall. A <picture> with a prefers-color-scheme source makes the
// browser download only the variant for the current theme, eagerly, so the nav never flashes empty.
// Computed once at module load: the props never change. Replace with SVG exports when available.
const common = { alt: site.name, width: 938, height: 320, sizes: "118px", loading: "eager" } as const;
const { props: night } = getImageProps({ ...common, src: "/logo/lockup-night.png" });
const { props: day } = getImageProps({ ...common, src: "/logo/lockup-day.png" });

export function Logo({ className, href = routes.home }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cx("flex min-h-11 items-center", className)}>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcSet={night.srcSet} sizes={night.sizes} />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps via the spread */}
        <img {...day} className="h-10 w-auto" />
      </picture>
    </Link>
  );
}
