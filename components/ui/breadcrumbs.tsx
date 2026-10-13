import Link from "next/link";
import { Icon } from "./icon";

export type Crumb = { label: string; href?: string };

/**
 * Where a page sits and the way back up: Admin › Leads › Ana Cruz. The last item is the current page
 * (not a link). Below 640px only the parent and the current page show, so the trail never wraps.
 * Use on pages two or more levels deep, never as the only navigation.
 */
export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0 font-sans text-sm leading-5 font-medium">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${i}-${item.label}`} className="inline-flex items-center gap-1 max-sm:[&:not(:nth-last-child(-n+2))]:hidden">
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined} className="font-semibold text-ink">
                  {item.label}
                </span>
              ) : (
                <>
                  <Link href={item.href} className="inline-flex min-h-8 items-center rounded-sm px-1 text-link underline-offset-[3px] hover:text-action-secondary-hover">
                    {item.label}
                  </Link>
                  <Icon name="chevron-right" size={16} className="text-ink-muted" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
