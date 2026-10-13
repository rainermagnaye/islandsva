import Link from "next/link";
import { cx } from "@/lib/cx";
import { Icon } from "./icon";

/** Page numbers to show: all up to 7, else first, last and the current page's neighbours, with gaps. */
export function pageList(page: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  let start = Math.max(2, page - 1);
  let end = Math.min(total - 1, page + 1);
  if (page <= 3) [start, end] = [2, 4];
  if (page >= total - 2) [start, end] = [total - 3, total - 1];
  return [
    1,
    ...(start > 2 ? ["gap" as const] : []),
    ...Array.from({ length: end - start + 1 }, (_, i) => start + i),
    ...(end < total - 1 ? ["gap" as const] : []),
    total,
  ];
}

type PaginationProps = {
  /** Names the nav, e.g. "Lead pages". */
  label: string;
  page: number;
  totalPages: number;
  /** Real links (`?page=3`), so the back button and bookmarks work. */
  hrefFor: (page: number) => string;
};

const target =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-3 font-sans text-sm leading-5 font-semibold tabular-nums no-underline";

/**
 * Previous · numbers · Next, as links. The current page is filled teal; every target is 44px. Below
 * 640px the numbers collapse to "Page 3 of 12". Renders nothing when everything fits on one page.
 */
export function Pagination({ label, page, totalPages, hrefFor }: PaginationProps) {
  if (totalPages <= 1 && page <= 1) return null;
  // A page past the end (stale link) steps back to the last real page.
  const previous = Math.min(page - 1, totalPages);

  return (
    <nav aria-label={label}>
      <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-1 p-0">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(previous)} rel="prev" className={cx(target, "text-ink hover:bg-action-ghost-hover")}>
              <Icon name="chevron-left" size={18} />
              Previous
            </Link>
          ) : (
            <span aria-disabled="true" className={cx(target, "text-disabled-ink")}>
              <Icon name="chevron-left" size={18} />
              Previous
            </span>
          )}
        </li>
        {pageList(Math.min(page, totalPages), totalPages).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-ink-muted max-sm:hidden">
              …
            </li>
          ) : (
            <li key={p} className="max-sm:hidden">
              <Link
                href={hrefFor(p)}
                aria-current={p === page ? "page" : undefined}
                className={cx(target, p === page ? "bg-action-secondary text-on-action-secondary" : "text-ink hover:bg-action-ghost-hover")}
              >
                <span className="sr-only">Page </span>
                {p}
              </Link>
            </li>
          ),
        )}
        <li aria-hidden="true" className="px-2 font-sans text-sm leading-5 font-medium text-ink-muted sm:hidden">
          Page {page} of {totalPages}
        </li>
        <li>
          {page < totalPages ? (
            <Link href={hrefFor(page + 1)} rel="next" className={cx(target, "text-ink hover:bg-action-ghost-hover")}>
              Next
              <Icon name="chevron-right" size={18} />
            </Link>
          ) : (
            <span aria-disabled="true" className={cx(target, "text-disabled-ink")}>
              Next
              <Icon name="chevron-right" size={18} />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
