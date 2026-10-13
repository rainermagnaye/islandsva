import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Button } from "./button";
import { CheckList } from "./check-list";
import type { IconName } from "@/types/icon";
import { IconBadge } from "./icon-badge";

type ServiceCardProps = {
  title: string;
  /** One sentence, outcome-first. */
  description?: string;
  icon?: IconName;
  price?: ReactNode;
  priceUnit?: string;
  /** 3–5 short lines. */
  features?: string[];
  /** At most one per grid: sunrise border, badge and the primary CTA. */
  featured?: boolean;
  badge?: string;
  /** Names the plan ("Choose Executive"), never "Learn more". */
  ctaLabel?: string;
  ctaHref?: string;
  headingLevel?: 2 | 3 | 4;
  className?: string;
};

export function ServiceCard({
  title,
  description,
  icon,
  price,
  priceUnit,
  features,
  featured,
  badge = featured ? "Most popular" : undefined,
  ctaLabel,
  ctaHref,
  headingLevel = 3,
  className,
}: ServiceCardProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <article
      className={cx(
        "relative flex flex-col gap-4 rounded-lg border bg-surface-card p-6 text-ink transition-[box-shadow,border-color] duration-200 hover:elevation-md",
        featured ? "border-2 border-action-primary" : "border-border hover:border-border-strong",
        className,
      )}
    >
      {badge && (
        <span className="absolute -top-3 left-6 rounded-pill bg-action-primary px-3 py-0.5 type-eyebrow tracking-[0.08em] text-on-action-primary">
          {badge}
        </span>
      )}
      {icon && <IconBadge name={icon} />}
      <Heading className="m-0 type-h3">{title}</Heading>
      {description && <p className="m-0 text-ink-muted">{description}</p>}
      {price && (
        <p className="m-0 font-display text-[2rem] leading-9 font-bold">
          {price}
          {priceUnit && <small className="ml-1 type-body-sm font-sans font-normal text-ink-muted">{priceUnit}</small>}
        </p>
      )}
      {features && features.length > 0 && <CheckList items={features} className="text-[0.9375rem]" />}
      {ctaLabel && ctaHref && (
        <div className="mt-auto pt-2">
          <Button href={ctaHref} variant={featured ? "primary" : "ghost"} block>
            {ctaLabel}
          </Button>
        </div>
      )}
    </article>
  );
}
