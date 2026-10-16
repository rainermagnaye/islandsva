import type { Metadata } from "next";
import { FaqSearch } from "@/components/marketing/faq-search";
import { PageHeader } from "@/components/marketing/page-header";
import { Prose } from "@/components/marketing/prose";
import { Section } from "@/components/marketing/section";
import { Container } from "@/components/ui/container";
import { termsFaqs } from "@/content/faqs";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms that apply when you use the Islands VA website.",
};

// TODO(legal): website terms only — client service agreements (billing, cancellation, refunds) are separate.
// Have this reviewed and set the effective date before launch.
export default function TermsPage() {
  return (
    <>
      <PageHeader title="Terms of use" lead="The terms that apply when you use this website." />
      <Container className="py-12 md:py-16">
        <Prose>
          <p>By using this website you agree to these terms. If you don&apos;t agree, please don&apos;t use the site.</p>

          <h2>Information on this site</h2>
          <p>
            We keep the information on this site accurate and up to date, but it&apos;s provided for general information.
            Packages, prices and availability may change. Your service agreement with {site.name} sets out the terms of any
            services we provide.
          </p>

          <h2>Using the site</h2>
          <p>
            Don&apos;t misuse the site — for example by attempting to break its security, overload it or send spam through the
            contact form.
          </p>

          <h2>Intellectual property</h2>
          <p>
            The {site.name} name, logo and site content belong to us. You may not reuse them without our written permission.
          </p>

          <h2>Liability</h2>
          <p>To the extent the law allows, we&apos;re not liable for losses arising from your use of this website.</p>

          <h2>Contact</h2>
          <p>Questions about these terms? Get in touch through our contact page.</p>
        </Prose>
      </Container>
      <Section id="faq" tone="sunken" align="center" eyebrow="Questions" title="Questions about these terms">
        <FaqSearch items={termsFaqs} />
      </Section>
    </>
  );
}
