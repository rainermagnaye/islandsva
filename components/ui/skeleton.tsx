import { cx } from "@/lib/cx";
import { cardSurface } from "./card";

const shimmer = "rounded-md bg-border/70 motion-safe:animate-pulse";
const size = (value: number | string | undefined) => (typeof value === "number" ? `${value}px` : value);

/**
 * A placeholder shape while data loads: text lines (the last one shorter), a rect for media or a circle for an
 * avatar. Hidden from screen readers; SkeletonCard (or the page's Suspense fallback) announces the loading.
 */
export function Skeleton({ variant = "text", lines = 3, width, height, className }: { variant?: "text" | "rect" | "circle"; lines?: number; width?: number | string; height?: number | string; className?: string }) {
  if (variant === "text") {
    return (
      <div aria-hidden="true" className={cx("grid gap-2", className)} style={{ width: size(width) }}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={cx(shimmer, "h-3.5")} style={{ width: i === lines - 1 && lines > 1 ? "60%" : "100%" }} />
        ))}
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cx(shimmer, variant === "circle" && "rounded-pill", className)}
      style={{ width: size(width ?? (variant === "circle" ? 40 : "100%")), height: size(height ?? (variant === "circle" ? 40 : 160)) }}
    />
  );
}

/** A card-shaped placeholder with the single "Loading" status for screen readers. */
export function SkeletonCard({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cx(cardSurface, "grid gap-4 p-6", className)}>
      <span className="sr-only">{label}</span>
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" />
        <Skeleton lines={2} className="flex-1" />
      </div>
      <Skeleton variant="rect" height={120} />
      <Skeleton lines={3} />
    </div>
  );
}
