import type { Testimonial } from "@/content/testimonials";

/** One client quote with attribution. Fills its parent's height so cards in a row line up. */
export function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const { quote, author, role, company } = testimonial;
  return (
    <figure className="m-0 flex h-full flex-col gap-6 rounded-lg border border-border bg-surface-card p-6">
      <blockquote className="m-0 type-body-lg text-ink">“{quote}”</blockquote>
      <figcaption className="mt-auto">
        <span className="block type-label">{author}</span>
        {(role || company) && <span className="type-body-sm text-ink-muted">{[role, company].filter(Boolean).join(", ")}</span>}
      </figcaption>
    </figure>
  );
}
