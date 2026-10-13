import type { Metadata } from "next";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageHeader } from "@/components/marketing/page-header";
import { Section } from "@/components/marketing/section";
import { TestimonialCard } from "@/components/marketing/testimonial-card";
import { Icon } from "@/components/ui/icon";
import { testimonials } from "@/content/testimonials";

export const metadata: Metadata = {
  title: "Testimonials",
  description: "What clients say about working with an Islands VA virtual assistant.",
};

export default function TestimonialsPage() {
  return (
    <>
      <PageHeader eyebrow="Testimonials" title="In our clients' words" lead="Real feedback from the people our assistants support every day." />
      <Section id="stories">
        {testimonials.length > 0 ? (
          <ul className="m-0 grid list-none gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <li key={t.id} className="reveal">
                <TestimonialCard testimonial={t} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid max-w-[52ch] justify-items-start gap-4 rounded-xl border border-border bg-surface-card p-8">
            <Icon name="message" size={32} className="text-action-secondary" />
            <h2 className="m-0 type-h3">Client stories are on their way</h2>
            <p className="m-0 text-ink-muted">
              We&apos;re gathering feedback from the businesses we support. In the meantime, book a call and we&apos;ll
              happily walk you through how we work with clients like you.
            </p>
          </div>
        )}
      </Section>
      <CtaBand />
    </>
  );
}
