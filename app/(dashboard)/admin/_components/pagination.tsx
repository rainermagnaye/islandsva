import Link from "next/link";

/** `?page=` as a positive integer; anything else is page 1. */
export function pageFrom(value: string | string[] | undefined) {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

type PaginationProps = {
  label: string;
  /** The list page, without a query string. */
  href: string;
  page: number;
  pageCount: number;
  /** Other query parameters to keep, e.g. the status filter. */
  params?: Record<string, string | undefined>;
};

/** Newer / Older links for a newest-first list. Renders nothing when everything fits on one page. */
export function Pagination({ label, href, page, pageCount, params = {} }: PaginationProps) {
  if (pageCount <= 1 && page <= 1) return null;

  const hrefFor = (target: number) => {
    const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined));
    if (target > 1) query.set("page", String(target));
    const search = query.toString();
    return search ? `${href}?${search}` : href;
  };

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-4 type-label">
      {/* A page past the end links back to the last real page. */}
      {page > 1 ? <Link href={hrefFor(Math.min(page - 1, pageCount))}>Newer</Link> : <span />}
      <span className="text-ink-muted">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? <Link href={hrefFor(page + 1)}>Older</Link> : <span />}
    </nav>
  );
}
