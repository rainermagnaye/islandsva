import type { ReactNode } from "react";

/** Title block of every sign-in screen: the page's single h1 and one supporting line. */
export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="grid gap-2">
      <h1 className="m-0 type-h2">{title}</h1>
      {children && <p className="m-0 text-ink-muted">{children}</p>}
    </div>
  );
}
