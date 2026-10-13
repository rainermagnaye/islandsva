import type { Metadata } from "next";
import { getImageProps } from "next/image";
import { CtaBand } from "@/components/marketing/cta-band";
import { FeatureList } from "@/components/marketing/feature-list";
import { PageHeader } from "@/components/marketing/page-header";
import { Section } from "@/components/marketing/section";
import { brands, industries } from "@/content/brands";

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
          <ul className="m-0 grid list-none grid-cols-2 gap-6 p-0 sm:grid-cols-3 lg:grid-cols-5">
            {brands.map((b) => (
              <li key={b.id} className="reveal grid h-24 place-items-center rounded-lg border border-border bg-surface-card p-4">
                {/* getImageProps + <img> renders on the server: optimised srcSet, zero client JS (unlike <Image>). */}
                {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- optimised via getImageProps, which also supplies alt */}
                <img {...getImageProps({ src: b.logo, alt: b.name, width: 160, height: 64 }).props} className="h-12 w-auto object-contain" />
              </li>
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
      <CtaBand />
    </>
  );
}
