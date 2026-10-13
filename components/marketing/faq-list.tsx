import { Icon } from "@/components/ui/icon";

/** Native <details> accordion — keyboard and screen-reader support with zero JavaScript. */
export function FaqList({ items }: { items: readonly { question: string; answer: string }[] }) {
  return (
    <div className="grid max-w-(--container-prose) gap-3">
      {items.map((item) => (
        <details key={item.question} className="group reveal rounded-lg border border-border bg-surface-card open:elevation-sm">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-5 py-4 type-h4 [&::-webkit-details-marker]:hidden">
            {item.question}
            <Icon name="chevron-down" className="text-ink-muted transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <p className="m-0 px-5 pb-5 text-ink-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
