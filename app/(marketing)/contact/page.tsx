import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";
import { Icon } from "@/components/ui/icon";
import { site } from "@/content/site";
import { ContactForm, ContactFormWithParams } from "@/features/leads/components/contact-form";

export const metadata: Metadata = {
  title: "Book a discovery call",
  description: "Tell us what's taking your time. We'll recommend the right virtual assistant package for your business.",
};

const nextSteps = [
  "We reply within one business day to book a 30-minute call.",
  "On the call, we learn how you work and what you'd like to hand off.",
  "We recommend a package and match you with a vetted VA.",
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Get started"
        title="Book a discovery call"
        lead="Tell us a little about your business and what's taking your time. There's no cost and no commitment."
      />
      <Container className="grid gap-10 py-12 md:py-16 lg:grid-cols-[1.5fr_1fr]">
        {/* Static shell renders the form immediately; the ?package= preselect hydrates in. */}
        <Suspense fallback={<ContactForm />}>
          <ContactFormWithParams />
        </Suspense>

        <aside className="grid content-start gap-8">
          <div className="grid gap-4">
            <h2 className="m-0 type-h3">What happens next</h2>
            <ol className="m-0 grid list-none gap-4 p-0">
              {nextSteps.map((step, i) => (
                <li key={step} className="grid grid-cols-[auto_1fr] gap-3">
                  <span className="grid size-8 place-items-center rounded-pill bg-status-info-bg type-label text-action-secondary">{i + 1}</span>
                  <span className="text-ink-muted">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid gap-3 rounded-lg bg-surface-sunken p-6">
            <h2 className="m-0 type-h4">Prefer email?</h2>
            {site.email ? (
              <a href={`mailto:${site.email}`} className="inline-flex min-h-11 items-center gap-2 type-label">
                <Icon name="message" />
                {site.email}
              </a>
            ) : (
              <p className="m-0 type-body-sm text-ink-muted">Use the form and we&apos;ll reply from our team inbox.</p>
            )}
            <p className="m-0 flex items-center gap-2 type-body-sm text-ink-muted">
              <Icon name="clock" size={16} />
              Our team is based in the {site.location} and covers day and night shifts.
            </p>
          </div>
        </aside>
      </Container>
    </>
  );
}
