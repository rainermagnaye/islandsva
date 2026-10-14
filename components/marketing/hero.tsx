import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DayNightArt } from "./day-night-art";

type Link = { label: string; href: string };

type HeroProps = {
  eyebrow: string;
  /** The one big promise, under ~10 words. The page's only h1. */
  title: string;
  /** One or two sentences, outcome first. */
  lead: string;
  /** The page's single sunrise button. */
  primary: Link;
  secondary?: Link;
  /** Real, verifiable facts only ("Month to month — no lock-in"). */
  proof?: ReactNode;
};

/**
 * The design system's Hero: eyebrow pill with the sun dot, the promise in Alegreya 800, lead, primary and
 * ghost CTAs, a proof line, and the day-and-night illustration. The Sand & Sea mark stays in the navbar.
 * Stacks below 880px of container width with the copy first. Never put text over the illustration.
 */
export function Hero({ eyebrow, title, lead, primary, secondary, proof }: HeroProps) {
  return (
    <div className="@container">
      <section aria-labelledby="hero-title" className="grid items-center gap-10 py-12 @min-[880px]:grid-cols-[1.1fr_1fr] @min-[880px]:gap-12 @min-[880px]:py-16">
        <div className="grid justify-items-start gap-5">
          <p className="m-0 inline-flex items-center gap-2 rounded-pill border border-border bg-surface-card py-1 pr-3 pl-2 type-eyebrow tracking-[0.14em] text-ink-accent before:size-2 before:rounded-full before:bg-brand-sun before:content-['']">
            {eyebrow}
          </p>
          <h1 id="hero-title" className="m-0 font-display text-[clamp(2.5rem,1.6rem+3.6vw,3.75rem)] leading-[1.04] font-extrabold tracking-[-0.015em] text-balance">
            {title}
          </h1>
          <p className="m-0 max-w-[54ch] type-body-lg text-ink-muted">{lead}</p>
          <div className="mt-1 flex flex-wrap gap-3">
            <Button href={primary.href} size="lg" iconRight="arrow-right">
              {primary.label}
            </Button>
            {secondary && (
              <Button href={secondary.href} size="lg" variant="ghost">
                {secondary.label}
              </Button>
            )}
          </div>
          {proof && <p className="m-0 type-body-sm font-medium text-ink-muted">{proof}</p>}
        </div>
        <div className="group w-full max-w-[520px] justify-self-center">
          <DayNightArt />
        </div>
      </section>
    </div>
  );
}
