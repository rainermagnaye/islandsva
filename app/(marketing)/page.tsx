import Link from "next/link";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqList } from "@/components/marketing/faq-list";
import { FeatureList } from "@/components/marketing/feature-list";
import { HeroArt } from "@/components/marketing/hero-art";
import { PackageCards } from "@/components/marketing/package-cards";
import { Section } from "@/components/marketing/section";
import { TestimonialCarousel } from "@/components/marketing/testimonial-carousel";
import { Button } from "@/components/ui/button";
import { CheckList } from "@/components/ui/check-list";
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
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -top-32 -left-24 size-[28rem] rounded-full bg-brand-lagoon/15 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute top-16 -right-20 size-[22rem] rounded-full bg-brand-sunrise/20 blur-3xl" />
      <Container className="relative grid items-center gap-12 py-16 md:py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28">
        <div className="hero-enter grid gap-6">
          <p className="m-0 type-eyebrow text-ink-accent">{site.tagline}</p>
          <h1 className="m-0 type-display-xl text-balance">Your business, handled while you sleep</h1>
          <p className="m-0 max-w-[52ch] type-body-lg text-ink-muted">
            A dedicated virtual assistant who learns how you work — then takes your inbox, calendar, customer replies and
            admin off your plate. Around the clock, if you need it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href={site.cta.href} size="lg" iconRight="arrow-right">
              {site.cta.label}
            </Button>
            <Button href={routes.packages} size="lg" variant="ghost">
              See packages
            </Button>
          </div>
          <CheckList items={highlights} className="pt-2 type-body-sm text-ink-muted sm:flex sm:flex-wrap sm:gap-x-6" />
        </div>
        <HeroArt />
      </Container>
      </section>

      <Section
        id="services"
        tone="sunken"
        eyebrow="What your VA handles"
        title="Hand off the work that eats your week"
        lead="Your assistant takes on the recurring tasks that keep your business running, so you can focus on the work only you can do."
      >
        <FeatureList items={services} />
      </Section>

      <Section id="how-it-works" eyebrow="How it works" title="From first call to first task in days" lead="We handle the hiring, matching and onboarding. You get an assistant who's ready to work.">
        <ol className="reveal-stagger m-0 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="reveal grid content-start gap-3 rounded-lg border border-border bg-surface-card p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:elevation-md">
              <span className="grid size-11 place-items-center rounded-pill bg-action-primary font-display text-[1.25rem] font-bold text-on-action-primary">
                {i + 1}
              </span>
              <h3 className="m-0 type-h3">{step.title}</h3>
              <p className="m-0 text-ink-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="day-and-night"
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

      <Section id="packages" eyebrow="Packages" title="Pick the support that fits" lead="Every package includes a dedicated, vetted VA and a team that has their back.">
        <PackageCards />
        <p className="mt-8 mb-0 type-body-sm text-ink-muted">
          Prices shown for a 12-month commitment. <Link href={routes.pricing}>Compare monthly, 6- and 12-month pricing</Link>.
        </p>
      </Section>

      {testimonials.length > 0 && (
        <Section id="testimonials" tone="sunken" eyebrow="Testimonials" title="What clients say">
          <TestimonialCarousel items={testimonials} />
        </Section>
      )}

      <Section id="faq" eyebrow="Questions" title="Good to know">
        <FaqList items={faqs} />
      </Section>

      <CtaBand />
    </>
  );
}
