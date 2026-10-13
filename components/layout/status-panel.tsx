import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { IconBadge } from "@/components/ui/icon-badge";
import type { IconName } from "@/types/icon";

type StatusPanelProps = {
  icon: IconName;
  /** The page's h1. */
  title: string;
  children: ReactNode;
  /** Up to two Buttons: the way forward first. */
  actions?: ReactNode;
};

/** Centred full-page message: not found, errors, "coming soon". No hooks, so error boundaries can use it too. */
export function StatusPanel({ icon, title, children, actions }: StatusPanelProps) {
  return (
    <Container className="grid min-h-[60dvh] place-items-center py-16">
      <div className="grid max-w-[44ch] justify-items-center gap-4 text-center">
        <IconBadge name={icon} size="lg" />
        <h1 className="m-0 type-h1">{title}</h1>
        <div className="grid gap-2 text-ink-muted [&_p]:m-0">{children}</div>
        {actions && <div className="flex flex-wrap justify-center gap-3 pt-2">{actions}</div>}
      </div>
    </Container>
  );
}
