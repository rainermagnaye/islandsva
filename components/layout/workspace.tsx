import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { cx } from "@/lib/cx";

/** A portal page: optional breadcrumbs, its h1, an optional supporting line and actions, then the content. */
export function Workspace({
  title,
  eyebrow,
  lead,
  actions,
  breadcrumbs,
  children,
  compact = false,
}: {
  title?: string;
  /** A short line above the title, e.g. today's date on a dashboard. */
  eyebrow?: ReactNode;
  lead?: ReactNode;
  /** Buttons for the whole page, beside the title (they wrap under it on narrow screens). */
  actions?: ReactNode;
  /** A Breadcrumbs trail, for pages two or more levels deep. */
  breadcrumbs?: ReactNode;
  children?: ReactNode;
  /** Skip the page title when the content already has the h1, so a dense screen fits without scrolling. */
  compact?: boolean;
}) {
  return (
    <Container className={cx("workspace-page grid", compact ? "gap-4 py-4 md:py-6" : "gap-8 py-10 md:py-12")}>
      {compact ? (
        breadcrumbs
      ) : (
        <div className="grid gap-2">
          {breadcrumbs}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid min-w-0 gap-2">
              {eyebrow && <p className="m-0 type-eyebrow text-ink-accent">{eyebrow}</p>}
              <h1 className="m-0 type-h1">{title}</h1>
              {lead && <p className="m-0 max-w-[60ch] text-ink-muted">{lead}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
          </div>
        </div>
      )}
      {children}
    </Container>
  );
}

/** Placeholder while a page's session-dependent content streams in. */
export function WorkspaceSkeleton() {
  return (
    <Container className="workspace-page grid gap-6 py-10 md:py-12" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-64 max-w-full rounded-md bg-border motion-safe:animate-pulse" />
      <div className="h-40 rounded-lg bg-border/60 motion-safe:animate-pulse" />
    </Container>
  );
}

/** A card announcing what a workspace will hold once its milestone ships. */
export function ComingSoon({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section" className="grid max-w-[60ch] gap-2">
      <h2 className="m-0 type-h3">{title}</h2>
      <p className="m-0 text-ink-muted">{children}</p>
    </Card>
  );
}
