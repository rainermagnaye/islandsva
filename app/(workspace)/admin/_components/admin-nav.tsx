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

// DashboardShell sidebar: 44px rows, current item lifted onto surface-card in action-secondary. From 768px
// to 1023px it's a 76px icon rail (labels stay as accessible names and tooltips); below 768px a
// scrollable row of tabs.
const linkClasses =
  "relative flex min-h-11 items-center gap-3 rounded-md px-3 type-label whitespace-nowrap text-ink no-underline hover:bg-action-ghost-hover md:max-lg:justify-center md:max-lg:px-0 [&[aria-current]]:bg-surface-card [&[aria-current]]:text-action-secondary [&[aria-current]]:elevation-sm";
const labelClasses = "flex-1 md:max-lg:sr-only";
// In the rail the badge sits on the icon's corner; elsewhere at the end of the row.
const badgeClasses = "md:max-lg:absolute md:max-lg:top-0.5 md:max-lg:right-1.5";

/** Admin menu. Server-rendered and static; only the current-section marker runs on the client. */
export function AdminNav({
  items,
  footer,
  label = "Admin",
}: {
  items: readonly AdminNavItem[];
  footer?: { href: string; label: string; icon: IconName };
  /** Accessible name for the menu. Not shown as a heading. */
  label?: string;
}) {
  return (
    <nav aria-label={label} className="portal-nav border-b border-border bg-surface-sunken md:border-r md:border-b-0">
      <div className="md:sticky md:top-0 md:grid md:px-3 md:py-4">
        <ul className="m-0 flex list-none gap-1 overflow-x-auto px-2 py-2 md:grid md:overflow-visible md:p-0">
          {items.map(({ href, label, icon, exact, badge }) => {
            const content = (
              <>
                <Icon name={icon} />
                <span className={labelClasses}>{label}</span>
              </>
            );
            return (
              <li key={href} className="flex-none">
                <Suspense
                  fallback={
                    <Link href={href} title={label} className={linkClasses}>
                      {content}
                    </Link>
                  }
                >
                  <NavLink href={href} exact={exact} title={label} className={linkClasses}>
                    {content}
                    {badge && <span className={badgeClasses}>{badge}</span>}
                  </NavLink>
                </Suspense>
              </li>
            );
          })}
        </ul>
        {footer && (
          <div className="hidden border-t border-border pt-4 md:block">
            <Link href={footer.href} title={footer.label} className={`${linkClasses} text-ink-muted`}>
              <Icon name={footer.icon} />
              <span className={labelClasses}>{footer.label}</span>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
