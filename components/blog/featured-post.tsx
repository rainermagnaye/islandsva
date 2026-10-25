import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { IslandCover } from "./island-cover";
import type { PostCardProps } from "./post-card";

type FeaturedPostProps = Omit<PostCardProps, "headingLevel"> & {
  eyebrow?: string;
  ctaLabel?: string;
  /** 1 when the banner title is the page's main heading; otherwise 2 under the blog's h1. */
  headingLevel?: 1 | 2 | 3;
};

/**
 * The one story the blog leads with: a brand-deep band with layered waves, a sun-dot eyebrow and a tilted cover.
 * Its CTA is the page's single primary button. The same in both themes (fixed brand hues); one post at a time.
 */
export function FeaturedPost({ title, href, excerpt, tone = "coral", image, imageAlt = "", author, date, dateTime, readTime, eyebrow = "Featured story", ctaLabel = "Read the story", headingLevel = 2, className }: FeaturedPostProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <section aria-label={eyebrow} className={cx("@container group relative overflow-hidden rounded-lg bg-brand-deep dark:border dark:border-border", className)}>
      <svg aria-hidden="true" viewBox="0 0 1200 120" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full transition-transform duration-500 group-hover:-translate-y-1.5 motion-reduce:transition-none">
        <path d="M0 60c200-40 400 40 600 0s400-40 600 0v60H0z" className="fill-brand-lagoon/25" />
        <path d="M0 80c200-30 400 30 600 0s400-30 600 0v40H0z" className="fill-brand-reef/30" />
        <path d="M0 100c200-20 400 20 600 0s400-20 600 0v20H0z" className="fill-brand-ocean/40" />
      </svg>
      <div className="relative grid items-center gap-8 p-6 @[768px]:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] @[768px]:p-10">
        <div className="grid content-start gap-4 [--color-focus-ring:var(--color-brand-sunrise)]">
          <p className="m-0 flex items-center gap-2 type-eyebrow text-brand-sunrise">
            <span aria-hidden="true" className="size-2 rounded-pill bg-brand-sunrise" />
            {eyebrow}
          </p>
          <Heading className="m-0 type-h2 text-brand-sand">{title}</Heading>
          {excerpt && <p className="m-0 max-w-[52ch] type-body text-ink-on-deep-muted">{excerpt}</p>}
          {(author || date || readTime) && (
            <p className="m-0 type-body-sm text-ink-on-deep-muted">
              {[author, date && <time key="d" dateTime={dateTime}>{date}</time>, readTime].filter(Boolean).map((part, i) => (
                <span key={i}>
                  {i > 0 && <span aria-hidden="true"> · </span>}
                  {part}
                </span>
              ))}
            </p>
          )}
          <div>
            <Button href={href} iconRight="arrow-right">
              {ctaLabel}
            </Button>
          </div>
        </div>
        <div className="aspect-video -rotate-2 overflow-hidden rounded-lg elevation-lg transition-transform duration-500 group-hover:rotate-0 motion-reduce:transition-none">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- consumers pass optimised URLs; next/image would add client JS
            <img src={image} alt={imageAlt} className="h-full w-full object-cover" />
          ) : (
            <IslandCover tone={tone} />
          )}
        </div>
      </div>
    </section>
  );
}
