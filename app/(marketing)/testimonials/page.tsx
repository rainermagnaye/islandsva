import type { Metadata } from "next";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSearch } from "@/components/marketing/faq-search";
import { PageHeader } from "@/components/marketing/page-header";
import { Section } from "@/components/marketing/section";
import { TestimonialGrid } from "@/components/marketing/testimonial-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { site } from "@/content/site";
import { testimonialFaqs } from "@/content/faqs";
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
          <TestimonialGrid items={testimonials} label="Client testimonials" />
        ) : (
          <EmptyState
            title="Client stories are on their way"
            description="We're gathering feedback from the businesses we support. In the meantime, book a call and we'll walk you through how we work with clients like you."
            action={
              <Button href={site.cta.href} variant="secondary">
                {site.cta.label}
              </Button>
            }
          />
        )}
      </Section>
      <Section id="faq" tone="sunken" align="center" eyebrow="Questions" title="Before you decide">
        <FaqSearch items={testimonialFaqs} />
      </Section>
      <CtaBand />
    </>
  );
}
