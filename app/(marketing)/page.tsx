import Link from "next/link";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqList } from "@/components/marketing/faq-list";
import { FeatureList } from "@/components/marketing/feature-list";
import { Hero } from "@/components/marketing/hero";
import { PackageCards } from "@/components/marketing/package-cards";
import { Section } from "@/components/marketing/section";
import { TestimonialGrid } from "@/components/marketing/testimonial-card";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Icon } from "@/components/ui/icon";
import { routes } from "@/content/routes";
import { faqs, services, steps } from "@/content/services";
import { site } from "@/content/site";
import { testimonials } from "@/content/testimonials";

const highlights = ["Vetted assistants from the Philippines", "Day, night or both", "Month to month — no lock-in"];

export default function HomePage() {
  return (
    <>
      <Container>
        <Hero
          eyebrow={site.tagline}
          title="Your business, handled while you sleep"
          lead="A dedicated virtual assistant who learns how you work — then takes your inbox, calendar, customer replies and admin off your plate. Around the clock, if you need it."
          primary={site.cta}
          secondary={{ label: "See packages", href: routes.packages }}
          proof={highlights.join(" · ")}
        />
        {/* TODO(content): a LogoStrip ("Trusted by teams at…") goes here once clients agree to be named. */}
      </Container>

      <Section
        id="services"
        align="center"
        tone="sunken"
        eyebrow="What your VA handles"
        title="Hand off the work that eats your week"
        lead="Your assistant takes on the recurring tasks that keep your business running, so you can focus on the work only you can do."
      >
        <FeatureList items={services} />
      </Section>

      <Section id="how-it-works" align="center" eyebrow="How it works" title="From first call to first task in days" lead="We handle the hiring, matching and onboarding. You get an assistant who's ready to work.">
        <ol className="reveal-stagger m-0 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Card as="li" lift key={step.title} className="reveal grid content-start gap-3">
              <span className="grid size-11 place-items-center rounded-pill bg-action-primary font-display text-[1.25rem] font-bold text-on-action-primary">
                {i + 1}
              </span>
              <h3 className="m-0 type-h3">{step.title}</h3>
              <p className="m-0 text-ink-muted">{step.description}</p>
            </Card>
          ))}
        </ol>
      </Section>

      <Section
        id="day-and-night"
        align="center"
        tone="deep"
        eyebrow="Support, day and night"
        title="Your business doesn't stop at 5 pm. Neither do we."
        lead="Choose daytime cover, overnight cover or both. With two assistants on shifts, your customers get answers while you sleep and you wake up to a clear inbox."
      >
        <div className="reveal-stagger grid gap-6 md:grid-cols-2">
          {[
            { icon: "sun" as const, title: "Day shift", body: "Meetings scheduled, follow-ups sent and admin cleared during your working hours." },
            { icon: "moon" as const, title: "Night shift", body: "Customer replies, overnight orders and prep work done before you wake up." },
          ].map((shift) => (
            <div key={shift.title} className="reveal grid content-start gap-3 rounded-lg border border-ink-on-deep-muted/25 p-6 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand-sunrise/50">
              <Icon name={shift.icon} size={32} className="text-brand-sunrise" />
              <h3 className="m-0 type-h3 text-brand-sand">{shift.title}</h3>
              <p className="m-0 text-ink-on-deep-muted">{shift.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="packages" align="center" eyebrow="Packages" title="Pick the support that fits" lead="Every package includes a dedicated, vetted VA and a team that has their back.">
        <PackageCards />
        <p className="mt-8 mb-0 text-center type-body-sm text-ink-muted">
          Prices shown for a 12-month commitment. <Link href={routes.pricing}>Compare monthly, 6- and 12-month pricing</Link>.
        </p>
      </Section>

      {testimonials.length > 0 && (
        <Section id="testimonials" align="center" tone="sunken" eyebrow="Testimonials" title="What clients say">
          <TestimonialGrid items={testimonials} />
        </Section>
      )}

      <Section id="faq" align="center" eyebrow="Questions" title="Good to know">
        <FaqList items={faqs} />
      </Section>

      <CtaBand />
    </>
  );
}
