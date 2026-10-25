"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCurrentPath } from "@/hooks/use-current-path";

type WorkspaceNavLinkProps = { href: string; exact?: boolean; title?: string; className: string; children: ReactNode };

/**
 * Marks the current section with aria-current — the only reason this is a client component. On a lead's
 * own page the path isn't known at build time, so the parent renders it inside Suspense with a plain link.
 */
export function WorkspaceNavLink({ href, exact, title, className, children }: WorkspaceNavLinkProps) {
  const current = useCurrentPath(href, { exact });

  return (
    <Link href={href} title={title} aria-current={current === "page" ? "page" : current ? "true" : undefined} className={className}>
      {children}
    </Link>
  );
}
