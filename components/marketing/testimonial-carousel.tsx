import type { Testimonial } from "@/content/testimonials";
import { TestimonialCard } from "./testimonial-card";

/** CSS scroll-snap carousel: swipe on touch, scroll or tab through on desktop. No JS, no autoplay. */
export function TestimonialCarousel({ items }: { items: readonly Testimonial[] }) {
  return (
    <ul
      aria-label="Client testimonials"
      className="m-0 -mx-4 flex list-none snap-x snap-mandatory gap-6 overflow-x-auto scroll-px-4 px-4 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6"
    >
      {items.map((t) => (
        <li key={t.id} className="w-[85%] max-w-[420px] flex-none snap-start sm:w-[60%] lg:w-[32%]">
          <TestimonialCard testimonial={t} />
        </li>
      ))}
    </ul>
  );
}
