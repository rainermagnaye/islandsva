import Link from "next/link";
import type { ReactNode } from "react";
import { cardSurface } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { TagChip } from "@/components/ui/tag-chip";
import { TONE_CLASSES, type Tone } from "@/components/ui/tone";
import { cx } from "@/lib/cx";

export type BlogCategory = { label: string; href: string; count?: number; tone?: Tone; current?: boolean };
export type BlogTag = { label: string; href: string; tone?: Tone; current?: boolean };

type BlogSidebarProps = {
  categories?: readonly BlogCategory[];
  tags?: readonly BlogTag[];
  tagsTitle?: string;
  /** GET target for the search form (param q). */
  searchAction?: string;
  searchPlaceholder?: string;
  /** Extra panels after the tags, e.g. a compact CtaBand. */
  children?: ReactNode;
  className?: string;
};

const panel = cx(cardSurface, "grid gap-3 p-5");

/** The blog's secondary navigation: search, categories with counts and a tag cloud. A server component; search is a plain GET form. */
export function BlogSidebar({ categories = [], tags = [], tagsTitle = "Tags", searchAction = "/blog/search", searchPlaceholder = "Search articles", children, className }: BlogSidebarProps) {
  return (
    <div className={cx("grid content-start gap-6", className)}>
      <form role="search" action={searchAction} method="get" className={panel}>
        <label htmlFor="blog-search" className="type-label text-ink">
          Search the blog
        </label>
        <div className="flex gap-2">
          <input id="blog-search" name="q" type="search" placeholder={searchPlaceholder} className="min-h-11 min-w-0 flex-1 rounded-md border-control border-border-strong bg-surface-card px-3 type-body text-ink" />
          <button type="submit" aria-label="Search" className="grid size-11 shrink-0 place-items-center rounded-md bg-action-secondary text-on-action-secondary">
            <Icon name="search" size={20} />
          </button>
        </div>
      </form>
      {categories.length > 0 && (
        <nav aria-label="Categories" className={panel}>
          <h2 className="m-0 type-label text-ink">Categories</h2>
          <ul className="m-0 grid list-none gap-0.5 p-0">
            {categories.map((category) => (
              <li key={category.href}>
                <Link
                  href={category.href}
                  aria-current={category.current ? "page" : undefined}
                  className={cx(
                    "flex min-h-11 items-center gap-3 rounded-md px-2 type-body-sm no-underline transition-transform duration-150 hover:translate-x-1 hover:bg-action-ghost-hover motion-reduce:hover:translate-x-0",
                    category.current ? "bg-action-ghost-hover font-semibold text-action-secondary" : "text-ink",
                  )}
                >
                  <span aria-hidden="true" className={cx("size-2 rounded-pill", TONE_CLASSES[category.tone ?? "lagoon"].fill)} />
                  <span className="flex-1">{category.label}</span>
                  {category.count !== undefined && (
                    <span className="type-caption text-ink-muted tabular-nums">
                      {category.count}
                      <span className="sr-only"> posts</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {tags.length > 0 && (
        <section aria-label={tagsTitle} className={panel}>
          <h2 className="m-0 type-label text-ink">{tagsTitle}</h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {tags.map((tag) => (
              <li key={tag.href}>
                <TagChip tone={tag.tone} href={tag.href} current={tag.current}>
                  {tag.label}
                </TagChip>
              </li>
            ))}
          </ul>
        </section>
      )}
      {children}
    </div>
  );
}

/** The blog index frame: an optional featured banner, the main column, and a sidebar that sticks as a 300px column from 1024px of container width. */
export function BlogLayout({ featured, sidebar, sidebarLabel = "Blog", children, className }: { featured?: ReactNode; sidebar?: ReactNode; sidebarLabel?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cx("@container grid gap-8", className)}>
      {featured}
      <div className="grid gap-8 @[1024px]:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 content-start gap-8">{children}</div>
        {sidebar && (
          <aside aria-label={sidebarLabel} className="@[1024px]:sticky @[1024px]:top-24 @[1024px]:self-start">
            {sidebar}
          </aside>
        )}
      </div>
    </div>
  );
}
