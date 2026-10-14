import { getImageProps } from "next/image";
import Link from "next/link";
import { routes } from "@/content/routes";
import { site } from "@/content/site";
import { cx } from "@/lib/cx";

// mark.png is the supplied badge with the white moon-disc removed and the trunk knocked out.
// trunk.png is only that trunk, tinted with the theme text color: dark on light, light on dark.
const MARK = { src: "/logo/mark.png", width: 214, height: 215 } as const;

export function LogoLockup({
  alt,
  className,
  sizes = "44px",
  trunkClassName = "bg-ink",
}: {
  alt: string;
  className?: string;
  sizes?: string;
  /** Trunk mask colour. Light on the fixed dark footer, theme ink everywhere else. */
  trunkClassName?: string;
}) {
  const { props } = getImageProps({ alt, sizes, unoptimized: true, ...MARK });

  return (
    <span className={cx("relative block", className)} style={{ aspectRatio: "214 / 215" }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element -- a 9 KB mark served as-is at 44px (unoptimized above); alt comes from the spread */}
      <img {...props} className="block h-full w-full" />
      <span
        aria-hidden="true"
        className={cx("pointer-events-none absolute inset-0", trunkClassName)}
        style={{
          WebkitMaskImage: "url(/logo/trunk.png)",
          maskImage: "url(/logo/trunk.png)",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
        }}
      />
    </span>
  );
}

type LogoProps = {
  className?: string;
  href?: string;
  /** night = sand mark and name, for the brand-deep footer that looks the same in both themes. */
  tone?: "auto" | "night";
};

export function Logo({ className, href = routes.home, tone = "auto" }: LogoProps) {
  if (tone === "night") {
    return (
      <Link href={href} className={cx("flex min-h-11 items-center gap-2", className)}>
        <LogoLockup alt="" className="size-11 shrink-0" sizes="44px" trunkClassName="bg-brand-sand" />
        <span className="font-display text-[1.5rem] leading-none font-bold tracking-[-0.02em] whitespace-nowrap text-brand-sand">
          {site.name}
        </span>
      </Link>
    );
  }
  return (
    <Link href={href} className={cx("flex min-h-11 items-center gap-2", className)}>
      <LogoLockup alt="" className="size-11 shrink-0" sizes="44px" />
      <span className="grid gap-1">
        <span className="font-display text-[1.5rem] leading-none font-bold tracking-[-0.02em] whitespace-nowrap text-ink">
          {site.name}
        </span>
        <span className="text-[0.625rem] leading-none font-semibold tracking-[0.14em] uppercase whitespace-nowrap text-ink">
          {site.tagline}
        </span>
      </span>
    </Link>
  );
}
