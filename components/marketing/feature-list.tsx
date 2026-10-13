import { IconBadge } from "@/components/ui/icon-badge";
import type { IconName } from "@/types/icon";

export type Feature = { icon: IconName; title: string; description: string };

/** Grid of icon cards (services, industries): 1 → 2 → 3 columns. */
export function FeatureList({ items }: { items: readonly Feature[] }) {
  return (
    <ul className="reveal-stagger m-0 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.title} className="reveal grid content-start gap-3 rounded-lg border border-border bg-surface-card p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:elevation-md">
          <IconBadge name={item.icon} />
          <h3 className="m-0 type-h3">{item.title}</h3>
          <p className="m-0 text-ink-muted">{item.description}</p>
        </li>
      ))}
    </ul>
  );
}
