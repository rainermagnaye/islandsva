import type { ReactNode } from "react";

/** Sand, lagoon and sunrise wash, with a shoreline along the bottom. */
export function IslandShore({ children }: { children: ReactNode }) {
  return (
    <div className="island-shore relative">
      {children}
      <svg aria-hidden="true" viewBox="0 0 1200 48" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-12 w-full">
        <path d="M0 22c160-18 320 16 480 0s320-16 480 0 240 16 240 0v26H0z" className="fill-brand-lagoon/50" />
        <path d="M0 32c160-12 320 12 480 0s320-12 480 0 240 12 240 0v16H0z" className="fill-brand-reef/60" />
      </svg>
    </div>
  );
}
