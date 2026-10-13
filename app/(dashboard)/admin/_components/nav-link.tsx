"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavLinkProps = { href: string; exact?: boolean; className: string; children: ReactNode };

/**
 * Marks the current section with aria-current — the only reason this is a client component. On a lead's
 * own page the path isn't known at build time, so the parent renders it inside Suspense with a plain link.
 */
export function NavLink({ href, exact, className, children }: NavLinkProps) {
  const pathname = usePathname();
  const isPage = pathname === href;
  const inSection = isPage || (!exact && pathname.startsWith(`${href}/`));

  return (
    <Link href={href} aria-current={isPage ? "page" : inSection ? "true" : undefined} className={className}>
      {children}
    </Link>
  );
}
