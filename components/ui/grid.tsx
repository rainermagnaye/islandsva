import type { CSSProperties, ElementType, ReactNode } from "react";
import { cx } from "@/lib/cx";

/** 4 columns on mobile, 8 from 768px, 12 from 1024px — sized by its container, not the viewport. */
export function Grid({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className="@container">
      <div className={cx("grid grid-cols-4 gap-4 @min-[768px]:grid-cols-8 @min-[768px]:gap-6 @min-[1024px]:grid-cols-12", className)}>{children}</div>
    </div>
  );
}

type GridItemProps = {
  /** Columns spanned on mobile (of 4). */
  span?: number;
  /** Columns from 768px (of 8). Inherits `span` when unset. */
  md?: number;
  /** Columns from 1024px (of 12). Inherits `md` when unset. */
  lg?: number;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
};

export function GridItem({ span = 4, md, lg, as: Tag = "div", className, children }: GridItemProps) {
  const style = { "--s": span, "--s-md": md ?? span, "--s-lg": lg ?? md ?? span } as CSSProperties;
  return (
    <Tag
      style={style}
      className={cx(
        "col-span-(--s) grid min-w-0 @min-[768px]:col-span-(--s-md) @min-[1024px]:col-span-(--s-lg)",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
