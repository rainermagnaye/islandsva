import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { IslandShore } from "./island-shore";

/** Top of every inner page: the page's single h1, on the shore wash. */
export function PageHeader({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <IslandShore>
      <Container className="grid max-w-(--container-max) gap-4 pt-12 pb-16 md:pt-16 md:pb-20">
        <div className="grid max-w-[60ch] gap-4">
          {eyebrow && <p className="m-0 type-eyebrow text-ink-accent">{eyebrow}</p>}
          <h1 className="m-0 type-h1 text-balance md:type-display-lg">{title}</h1>
          {lead && <p className="m-0 type-body-lg text-ink-muted">{lead}</p>}
        </div>
        {children}
      </Container>
    </IslandShore>
  );
}
