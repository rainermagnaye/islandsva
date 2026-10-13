import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

/** A portal page: its h1, an optional supporting line, then the content. */
export function Workspace({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <Container className="grid gap-8 py-10 md:py-12">
      <div className="grid gap-2">
        <h1 className="m-0 type-h1">{title}</h1>
        {lead && <p className="m-0 max-w-[60ch] text-ink-muted">{lead}</p>}
      </div>
      {children}
    </Container>
  );
}

/** Placeholder while a page's session-dependent content streams in. */
export function WorkspaceSkeleton() {
  return (
    <Container className="grid gap-6 py-10 md:py-12" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-64 max-w-full rounded-md bg-border motion-safe:animate-pulse" />
      <div className="h-40 rounded-lg bg-border/60 motion-safe:animate-pulse" />
    </Container>
  );
}

/** A card announcing what a workspace will hold once its milestone ships. */
export function ComingSoon({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid max-w-[60ch] gap-2 rounded-lg border border-border bg-surface-card p-6">
      <h2 className="m-0 type-h3">{title}</h2>
      <p className="m-0 text-ink-muted">{children}</p>
    </section>
  );
}
