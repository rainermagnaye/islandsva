import type { Metadata } from "next";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSearch } from "@/components/marketing/faq-search";
import { FeatureList } from "@/components/marketing/feature-list";
import { PageHeader } from "@/components/marketing/page-header";
import { Section } from "@/components/marketing/section";
import { Card } from "@/components/ui/card";
import { brands, industries } from "@/content/brands";
import { brandFaqs } from "@/content/faqs";

export const metadata: Metadata = {
  title: "Brands",
  description: "The businesses and industries Islands VA virtual assistants support.",
};

export default function BrandsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Brands"
        title="Trusted behind the scenes"
        lead="Our assistants work quietly inside growing businesses — answering customers, running calendars and keeping operations moving."
      />

      {brands.length > 0 && (
        <Section id="clients" title="Brands we support">
          <ul className="reveal-stagger m-0 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((brand) => (
              <Card as="li" lift key={brand.id} className="reveal grid content-center justify-items-center gap-4 py-8 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={brand.logo} alt="" className="h-16 w-auto max-w-full object-contain" />
                <h3 className="m-0 type-h4">{brand.name}</h3>
              </Card>
            ))}
          </ul>
        </Section>
      )}

      <Section
        id="industries"
        tone={brands.length > 0 ? "sunken" : "default"}
        eyebrow="Who we help"
        title="Built for busy businesses"
        lead="If your days are full of email, scheduling and follow-ups, an assistant can give you hours back every week."
      >
        <FeatureList items={industries} />
      </Section>
      <Section id="faq" align="center" eyebrow="Questions" title="Working with businesses like yours">
        <FaqSearch items={brandFaqs} />
      </Section>
      <CtaBand />
    </>
  );
}
