import Link from "next/link";

type FilterTabsProps<Value extends string> = {
  /** Names the nav for screen readers, e.g. "Filter leads by status". */
  label: string;
  /** The list page; each tab links to it with `?status=`. */
  href: string;
  options: Readonly<Record<Value, string>>;
  current: Value | undefined;
};

/** `?status=` as one of `options`; anything else (missing, tampered) means "All". */
export function filterFrom<Value extends string>(value: string | string[] | undefined, options: Readonly<Record<Value, string>>) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && Object.hasOwn(options, raw) ? (raw as Value) : undefined;
}

/**
 * Status filter as plain links: the filter lives in the URL (shareable, back button works) and needs no
 * client JavaScript. Changing the filter starts again at page 1.
 */
export function FilterTabs<Value extends string>({ label, href, options, current }: FilterTabsProps<Value>) {
  const tabs: [Value | undefined, string][] = [[undefined, "All"], ...(Object.entries(options) as [Value, string][])];

  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto">
      <ul className="m-0 flex w-max list-none gap-1 p-1">
        {tabs.map(([value, text]) => (
          <li key={value ?? "all"}>
            <Link
              href={value ? `${href}?status=${value}` : href}
              aria-current={value === current ? "page" : undefined}
              className="inline-flex min-h-9 items-center rounded-pill border border-border px-4 type-label text-ink no-underline hover:bg-action-ghost-hover aria-[current=page]:border-action-secondary aria-[current=page]:bg-action-secondary aria-[current=page]:text-on-action-secondary"
            >
              {text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
