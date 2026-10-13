import Link from "next/link";
import { listHref } from "./search-params";

type FilterTabsProps<Value extends string> = {
  /** Names the nav for screen readers, e.g. "Filter leads by status". */
  label: string;
  /** The list page; each tab links to it with `?status=`. */
  href: string;
  options: Readonly<Record<Value, string>>;
  current: Value | undefined;
};

/**
 * Status filter in the design system's pill Tabs style, rendered as links with aria-current (its rule for
 * tabs that need their own URL): shareable, the back button works, no client JavaScript. Changing the
 * filter starts again at page 1.
 */
export function FilterTabs<Value extends string>({ label, href, options, current }: FilterTabsProps<Value>) {
  const tabs: [Value | undefined, string][] = [[undefined, "All"], ...(Object.entries(options) as [Value, string][])];

  return (
    <nav aria-label={label} className="max-w-full overflow-x-auto [scrollbar-width:none]">
      <ul className="m-0 inline-flex list-none gap-1 rounded-pill bg-surface-sunken p-1">
        {tabs.map(([value, text]) => (
          <li key={value ?? "all"}>
            <Link
              href={listHref(href, { status: value })}
              aria-current={value === current ? "page" : undefined}
              className="inline-flex min-h-9 items-center rounded-pill px-4 type-label whitespace-nowrap text-ink-muted no-underline transition-colors hover:bg-action-ghost-hover hover:text-ink aria-[current=page]:bg-surface-card aria-[current=page]:text-action-secondary aria-[current=page]:elevation-sm"
            >
              {text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
