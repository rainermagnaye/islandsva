import type { ElementType, ReactNode } from "react";
import { cx } from "@/lib/cx";

type ContainerProps = {
  /** prose = 68ch for long-form text; default = 1200px page container. */
  width?: "page" | "prose";
  as?: ElementType;
  className?: string;
  children?: ReactNode;
};

/** Page gutters per the layout guide: 16px → 24px (640) → 32px (768); content caps at container-max. */
export function Container({ width = "page", as: Tag = "div", className, children }: ContainerProps) {
  return (
    <Tag
      className={cx(
        "mx-auto w-full px-4 sm:px-6 md:px-8",
        width === "prose" ? "max-w-(--container-prose)" : "max-w-(--container-max)",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
