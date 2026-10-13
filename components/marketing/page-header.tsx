import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

/** Top of every inner page: the page's single h1. */
export function PageHeader({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="border-b border-border bg-surface-sunken">
      <Container className="grid max-w-(--container-max) gap-4 py-12 md:py-16">
        <div className="grid max-w-[60ch] gap-4">
          {eyebrow && <p className="m-0 type-eyebrow text-ink-accent">{eyebrow}</p>}
          <h1 className="m-0 type-h1 text-balance md:type-display-lg">{title}</h1>
          {lead && <p className="m-0 type-body-lg text-ink-muted">{lead}</p>}
        </div>
        {children}
      </Container>
    </div>
  );
}
