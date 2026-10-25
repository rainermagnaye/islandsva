import type { ReactNode } from "react";
import { WaveDivider } from "./wave-divider";

/** Sand, lagoon and sunrise wash, with a shoreline along the bottom. */
export function IslandShore({ children }: { children: ReactNode }) {
  return (
    <div className="island-shore relative">
      {children}
      <WaveDivider className="absolute inset-x-0 bottom-0" />
    </div>
  );
}
