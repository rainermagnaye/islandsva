import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { cx } from "@/lib/cx";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title?: string;
  lead?: ReactNode;
  /** sunken = surface-sunken band; deep = brand-deep band (night-sky look in both themes). */
  tone?: "default" | "sunken" | "deep";
  align?: "start" | "center";
  className?: string;
  children?: ReactNode;
};

/** Full-bleed band whose content snaps back to the page container. Vertical rhythm per the layout guide. */
export function Section({ id, eyebrow, title, lead, tone = "default", align = "start", className, children }: SectionProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={cx(
        "py-12 md:py-16 lg:py-24",
        tone === "sunken" && "bg-surface-sunken",
        tone === "deep" && "bg-brand-deep text-brand-sand",
        className,
      )}
    >
      <Container>
        {(eyebrow || title || lead) && (
          <header className={cx("reveal mb-10 grid max-w-[60ch] gap-4", align === "center" && "mx-auto text-center")}>
            {eyebrow && (
              <p className={cx("m-0 type-eyebrow", tone === "deep" ? "text-brand-sunrise" : "text-ink-accent")}>{eyebrow}</p>
            )}
            {title && (
              <h2 id={headingId} className="m-0 type-display-lg text-balance">
                {title}
              </h2>
            )}
            {lead && (
              <p className={cx("m-0 type-body-lg", tone === "deep" ? "text-ink-on-deep-muted" : "text-ink-muted")}>{lead}</p>
            )}
          </header>
        )}
        {children}
      </Container>
    </section>
  );
}
