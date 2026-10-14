"use client";

import Link from "next/link";
import { useCurrentPath } from "@/hooks/use-current-path";
import { cx } from "@/lib/cx";

export type NavLink = { label: string; href: string };

const linkClasses =
  "inline-flex min-h-11 items-center rounded-md px-3 font-sans text-[0.875rem] leading-5 font-semibold text-ink no-underline hover:bg-action-ghost-hover aria-[current=page]:rounded-none aria-[current=page]:text-action-secondary aria-[current=page]:shadow-[inset_0_-2px_0_var(--action-secondary)]";

/** Marks the current page with aria-current; the only reason this is a client component. */
export function NavLinks({ links, variant }: { links: readonly NavLink[]; variant: "inline" | "drawer" }) {
  return (
    <ul
      className={cx(
        "m-0 list-none p-0",
        variant === "inline" ? "hidden gap-1 @min-[768px]:flex" : "mb-4 grid gap-1",
      )}
    >
      {links.map((link) => (
        <li key={link.href} className={variant === "inline" ? "nth-[n+4]:hidden @min-[1024px]:nth-[n+4]:list-item" : undefined}>
          <SiteNavLink link={link} className={cx(linkClasses, variant === "drawer" && "w-full text-[1rem]")} />
        </li>
      ))}
    </ul>
  );
}

/** One link; its own component because hooks can't run inside the map above. Exact match only. */
function SiteNavLink({ link, className }: { link: NavLink; className: string }) {
  const current = useCurrentPath(link.href, { exact: true });
  return (
    <Link href={link.href} aria-current={current ? "page" : undefined} className={className}>
      {link.label}
    </Link>
  );
}
