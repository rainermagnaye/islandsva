import type { Metadata } from "next";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqList } from "@/components/marketing/faq-list";
import { PageHeader } from "@/components/marketing/page-header";
import { Section } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
import { CheckList } from "@/components/ui/check-list";
import { Icon } from "@/components/ui/icon";
import { IconBadge } from "@/components/ui/icon-badge";
import { formatPrice, packages, startingPrice } from "@/content/packages";
import { contactHref, routes } from "@/content/routes";
import { faqs } from "@/content/services";
import { cx } from "@/lib/cx";

export const metadata: Metadata = {
  title: "Packages",
  description: "Essentials, Executive and Day and night virtual assistant packages — what each includes and who it's for.",
};

const included = [
  { icon: "users" as const, text: "A dedicated, vetted VA — not a shared pool" },
  { icon: "shield" as const, text: "Access through accounts you control" },
  { icon: "message" as const, text: "Regular check-ins and a team behind your VA" },
  { icon: "sliders" as const, text: "Change packages as your needs change" },
];

export default function PackagesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Packages"
        title="Support sized to your week"
        lead="Start part-time, go full-time, or cover both day and night. Every package comes with a dedicated assistant who learns your business."
      />

      <Section id="packages" title="Choose your package" className="pb-0 md:pb-0 lg:pb-0">
        <div className="grid gap-8">
          {packages.map((p) => (
            <article
              key={p.id}
              id={p.slug}
              className={cx(
                "reveal grid gap-8 rounded-xl border bg-surface-card p-6 md:grid-cols-[1fr_1.2fr] md:p-10",
                p.featured ? "border-2 border-action-primary" : "border-border",
              )}
            >
              <div className="grid content-start gap-4">
                <IconBadge name={p.icon} />
                {p.featured && <p className="m-0 type-eyebrow text-ink-accent">Most popular</p>}
                <h3 className="m-0 type-h2">{p.name}</h3>
                <p className="m-0 type-body-lg text-ink-muted">{p.tagline}</p>
                <dl className="m-0 grid gap-3">
                  <div>
                    <dt className="type-label text-ink">Time</dt>
                    <dd className="m-0 text-ink-muted">{p.hoursPerWeek}</dd>
                  </div>
                  <div>
                    <dt className="type-label text-ink">Best for</dt>
                    <dd className="m-0 text-ink-muted">{p.bestFor}</dd>
                  </div>
                  <div>
                    <dt className="type-label text-ink">Price</dt>
                    <dd className="m-0 text-ink-muted">
                      From <strong className="text-ink">{formatPrice(startingPrice(p), p.currency)}</strong> / month
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="grid content-start gap-6">
                <h4 className="m-0 type-h4">What&apos;s included</h4>
                <CheckList items={p.features} />
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button href={contactHref(p.slug)} variant={p.featured ? "primary" : "secondary"}>
                    {`Choose ${p.name}`}
                  </Button>
                  <Button href={routes.pricing} variant="ghost">
                    Compare pricing
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section id="included" title="In every package">
        <ul className="m-0 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {included.map((item) => (
            <li key={item.text} className="reveal flex items-start gap-3">
              <Icon name={item.icon} size={24} className="flex-none text-action-secondary" />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="faq" tone="sunken" eyebrow="Questions" title="Before you choose">
        <FaqList items={faqs} />
      </Section>

      <CtaBand title="Not sure which package fits?" body="Tell us about your week on a free discovery call and we'll recommend the right level of support." />
    </>
  );
}
