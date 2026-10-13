import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/types/icon";
import { NavLink } from "./nav-link";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Section pages and their sub-pages count as current; the overview only matches itself. */
  exact?: boolean;
  /** Streamed in by the server, e.g. the new-lead count. */
  badge?: ReactNode;
};

const linkClasses =
  "flex min-h-11 items-center gap-3 rounded-md px-3 type-label whitespace-nowrap text-ink no-underline hover:bg-action-ghost-hover [&[aria-current]]:bg-action-ghost-hover [&[aria-current]]:text-action-secondary";

/**
 * Admin menu: a sidebar from 1024px, a scrollable row of tabs below it (no menu button needed for a
 * handful of links). Server-rendered and static; only the current-section marker runs on the client.
 */
export function AdminNav({ items, footer }: { items: readonly AdminNavItem[]; footer?: ReactNode }) {
  return (
    <nav aria-label="Admin" className="border-b border-border bg-surface-card lg:border-r lg:border-b-0">
      <div className="lg:sticky lg:top-0 lg:grid lg:gap-4 lg:p-4">
        <p className="m-0 hidden px-3 type-label text-ink-muted lg:block">Admin</p>
        <ul className="m-0 flex list-none gap-1 overflow-x-auto px-2 py-2 lg:grid lg:overflow-visible lg:p-0">
          {items.map(({ href, label, icon, exact, badge }) => {
            const content = (
              <>
                <Icon name={icon} />
                <span className="flex-1">{label}</span>
              </>
            );
            return (
              <li key={href} className="flex-none">
                <Suspense
                  fallback={
                    <Link href={href} className={linkClasses}>
                      {content}
                    </Link>
                  }
                >
                  <NavLink href={href} exact={exact} className={linkClasses}>
                    {content}
                    {badge}
                  </NavLink>
                </Suspense>
              </li>
            );
          })}
        </ul>
        {footer && <div className="hidden border-t border-border pt-4 lg:block">{footer}</div>}
      </div>
    </nav>
  );
}
