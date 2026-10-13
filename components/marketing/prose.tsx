import type { ReactNode } from "react";

/** Long-form text (legal pages): 68ch measure, design-system heading and list rhythm. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-(--container-prose) text-ink [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:type-h3 [&_li]:mb-2 [&_p]:mb-4 [&_p]:text-ink-muted [&_ul]:mb-4 [&_ul]:pl-6 [&_ul]:text-ink-muted [&_ul]:list-disc">
      {children}
    </div>
  );
}
