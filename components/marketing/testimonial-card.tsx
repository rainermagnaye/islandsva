import { Badge } from "@/components/ui/badge";
import type { Testimonial } from "@/content/testimonials";
import { cx } from "@/lib/cx";

/**
 * One client quote (the design system's Testimonial): quote mark, the client's own words, name and role.
 * `featured` sets one large quote on brand-deep — at most one per page. Real quotes only, with consent.
 */
export function TestimonialCard({ testimonial, featured }: { testimonial: Testimonial; featured?: boolean }) {
  const { quote, author, role, company, sample } = testimonial;
  return (
    <figure
      className={cx(
        "relative m-0 flex h-full flex-col gap-4 rounded-lg border p-6 transition-[translate,box-shadow] duration-240 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-[3px] hover:elevation-md",
        featured ? "border-transparent bg-brand-deep text-brand-sand" : "border-border bg-surface-card",
      )}
    >
      {sample && (
        <Badge tone="warning" size="sm" className="absolute top-4 right-4">
          Sample
        </Badge>
      )}
      <svg viewBox="0 0 40 32" aria-hidden="true" focusable="false" className={cx("h-7 w-9", featured ? "fill-brand-sunrise" : "fill-brand-lagoon")}>
        <path d="M2 30V18C2 8 8 2 17 1v6c-5 1-8 5-8 10h8v13zM23 30V18c0-10 6-16 15-17v6c-5 1-8 5-8 10h8v13z" />
      </svg>
      <blockquote className="m-0 flex-1">
        <p className={cx("m-0", featured ? "font-display text-[1.375rem] leading-[1.875rem] font-bold" : "text-[1.0625rem] leading-[1.6875rem]")}>{quote}</p>
      </blockquote>
      <figcaption>
        <span className="block text-[0.9375rem] leading-5 font-semibold">{author}</span>
        {(role || company) && (
          <span className={cx("block type-body-sm", featured ? "text-ink-on-deep-muted" : "text-ink-muted")}>{[role, company].filter(Boolean).join(", ")}</span>
        )}
      </figcaption>
    </figure>
  );
}

/** The design system's TestimonialGrid: one column on phones, up to three on desktop. The first quote is featured. */
export function TestimonialGrid({ items, label = "What clients say" }: { items: readonly Testimonial[]; label?: string }) {
  return (
    <ul aria-label={label} className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-6 p-0">
      {items.map((t, i) => (
        <li key={t.id} className="reveal grid">
          <TestimonialCard testimonial={t} featured={i === 0 && items.length > 2} />
        </li>
      ))}
    </ul>
  );
}
