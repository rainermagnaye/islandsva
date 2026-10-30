import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

// Layout pieces shared by the registration link's steps (server and client components alike).

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section" padding="none">
      <h2 className="m-0 border-b border-border px-4 py-3 type-label">{title}</h2>
      <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export function Wide({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-3 sm:col-span-2">{children}</div>;
}

export function ReadOnly({ label, value }: { label: string; value: string }) {
  const shown = value.trim() || "Not provided";
  return (
    <div className="min-w-0">
      <p className="m-0 type-caption text-ink-muted">{label}</p>
      <p className={`m-0 type-body-sm ${shown === "Not provided" ? "text-ink-muted" : "text-ink"}`}>{shown}</p>
    </div>
  );
}
