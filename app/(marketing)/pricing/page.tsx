import type { Metadata } from "next";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageHeader } from "@/components/marketing/page-header";
import { Section } from "@/components/marketing/section";
import { PricingTable } from "./_components/pricing-table";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple monthly pricing for a dedicated virtual assistant. Pay month to month or save with a 6- or 12-month commitment.",
};

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Simple pricing, no surprises"
        lead="One monthly price per package. Pay month to month, or commit to 6 or 12 months and pay less each month."
      />
      <Section id="plans" title="Compare plans" className="pt-10 md:pt-12 lg:pt-16">
        <PricingTable />
      </Section>
      <CtaBand title="Questions about pricing?" body="We'll walk you through what each package covers and help you pick the right term." />
    </>
  );
}
