import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { routes } from "@/content/routes";
import { site } from "@/content/site";

/** Closing call to action on every marketing page, on the sand surface with lagoon waves. */
export function CtaBand({
  title = "Get your time back this month",
  body = "Book a free 30-minute discovery call. We'll learn how you work and recommend the right assistant.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <Container className="py-12 md:py-16">
      <div className="reveal relative isolate grid gap-6 overflow-hidden rounded-xl bg-surface-sand px-6 pt-8 pb-14 md:grid-cols-[1.2fr_1fr] md:items-center md:px-12 md:pt-12 md:pb-16">
        <div className="grid gap-3">
          <p className="m-0 type-eyebrow text-ink-accent">{site.tagline}</p>
          <h2 className="m-0 type-h2 text-balance">{title}</h2>
          <p className="m-0 max-w-[52ch] text-ink-muted">{body}</p>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          <Button href={site.cta.href} size="lg" iconRight="arrow-right">
            {site.cta.label}
          </Button>
          <Button href={routes.pricing} size="lg" variant="ghost">
            See pricing
          </Button>
        </div>
        <svg aria-hidden="true" viewBox="0 0 1200 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 -z-10 h-10 w-full">
          <path d="M0 22c150-18 300 18 450 0s300-18 450 0 300 18 300 0v18H0z" className="fill-brand-lagoon opacity-45" />
          <path d="M0 30c150-12 300 12 450 0s300-12 450 0 300 12 300 0v10H0z" className="fill-brand-reef opacity-60" />
        </svg>
      </div>
    </Container>
  );
}
