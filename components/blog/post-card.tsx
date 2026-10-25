import Link from "next/link";
import { Children, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cardSurface } from "@/components/ui/card";
import { TagChip } from "@/components/ui/tag-chip";
import type { Tone } from "@/components/ui/tone";
import { cx } from "@/lib/cx";
import { IslandCover } from "./island-cover";

export type PostCardProps = {
  title: string;
  href: string;
  /** One or two sentences, clamped to three lines. */
  excerpt?: string;
  category?: string;
  tone?: Tone;
  /** Cover photo (16:9). Omitted = the illustrated island in the tone. */
  image?: string;
  /** Only when the photo carries information; covers are decorative by default. */
  imageAlt?: string;
  author?: string;
  avatar?: string;
  /** Display date ("Oct 8, 2026"); dateTime = ISO for <time>. */
  date?: string;
  dateTime?: string;
  readTime?: string;
  headingLevel?: 2 | 3 | 4;
  className?: string;
};

/**
 * A blog teaser where the whole card is one link: the title is the only <a> and a stretched ::after covers the
 * card, so screen readers hear the title once. Lifts on hover; the category chip is a static label.
 */
export function PostCard({ title, href, excerpt, category, tone = "lagoon", image, imageAlt = "", author, avatar, date, dateTime, readTime, headingLevel = 3, className }: PostCardProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <article
      className={cx(
        cardSurface,
        "group relative grid overflow-hidden transition-[transform,box-shadow,border-color] duration-200 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring hover:-translate-y-1 hover:border-border-strong hover:elevation-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <div className="aspect-video overflow-hidden bg-surface-sunken">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- consumers pass optimised URLs; next/image would add client JS
          <img src={image} alt={imageAlt} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <IslandCover tone={tone} />
        )}
      </div>
      <div className="grid content-start gap-3 p-6">
        {category && (
          <TagChip tone={tone} size="sm" className="justify-self-start">
            {category}
          </TagChip>
        )}
        <Heading className="m-0 type-h4 text-ink">
          <Link
            href={href}
            className="text-inherit no-underline decoration-brand-sunrise decoration-2 underline-offset-4 outline-none after:absolute after:inset-0 group-hover:text-action-secondary group-hover:underline"
          >
            {title}
          </Link>
        </Heading>
        {excerpt && <p className="m-0 line-clamp-3 type-body-sm text-ink-muted">{excerpt}</p>}
        {(author || date || readTime) && (
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 type-caption text-ink-muted">
            {author && (
              <span className="inline-flex items-center gap-2">
                <Avatar name={author} src={avatar} tone={tone} size="sm" />
                <span className="font-semibold text-ink">{author}</span>
              </span>
            )}
            {date && <time dateTime={dateTime}>{date}</time>}
            {date && readTime && <span aria-hidden="true">·</span>}
            {readTime && <span>{readTime}</span>}
          </p>
        )}
      </div>
    </article>
  );
}

/** A responsive list of PostCards: one column on phones, two beside the sidebar, three full width. */
export function PostGrid({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <ul aria-label={label} className={cx("m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,272px),1fr))] gap-6 p-0", className)}>
      {Children.map(children, (child) => (
        <li className="grid">{child}</li>
      ))}
    </ul>
  );
}
