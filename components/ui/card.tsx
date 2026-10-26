import { useId, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { cardSurface } from "./card-surface";

export { cardSurface };

const paddings = {
  none: "",
  sm: "px-4 py-3",
  md: "p-6",
  lg: "p-6 md:p-8",
} as const;

type CardProps = Omit<HTMLAttributes<HTMLElement>, "className"> & {
  as?: "div" | "section" | "header" | "article" | "li";
  /** sm = compact bars (profile header); md = panels and cards; lg = a form that is the page's focus. */
  padding?: keyof typeof paddings;
  /** Rises on hover — only for cards in a grid of peers (how-it-works steps, features). */
  lift?: boolean;
  className?: string;
};

/** The white (Night: lagoon) surface with a hairline border that every card and boxed panel sits on. */
export function Card({ as: Tag = "div", padding = "md", lift, className, children, ...rest }: CardProps) {
  return (
    <Tag
      {...rest}
      className={cx(
        cardSurface,
        paddings[padding],
        lift && "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:elevation-md",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

type PanelProps = {
  title: string;
  /** Shown at the end of the title row, e.g. a "View all" link. */
  action?: ReactNode;
  /** Boxed panels sit on a Card; open ones (overview lists, form sections) sit on the page. */
  boxed?: boolean;
  headingLevel?: 2 | 3;
  className?: string;
  children: ReactNode;
};

/** A titled section of a portal page: the heading names the section for screen readers too. */
export function Panel({ title, action, boxed, headingLevel = 2, className, children }: PanelProps) {
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  const body = (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Heading id={id} className="m-0 type-h3">
          {title}
        </Heading>
        {action}
      </div>
      {children}
    </>
  );

  return boxed ? (
    <Card as="section" aria-labelledby={id} className={cx("grid gap-4", className)}>
      {body}
    </Card>
  ) : (
    <section aria-labelledby={id} className={cx("grid gap-4", className)}>
      {body}
    </section>
  );
}
