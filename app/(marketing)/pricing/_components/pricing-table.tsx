import { Grid, GridItem } from "@/components/ui/grid";
import { ServiceCard } from "@/components/ui/service-card";
import { formatPrice, packages, terms, type SubscriptionTerm } from "@/content/packages";
import { contactHref } from "@/content/routes";

// Every term's price is in the HTML; radio inputs + :has() show the selected one. Zero JavaScript.
const visibleWhen: Record<SubscriptionTerm, string> = {
  1: "hidden group-has-[#term-1:checked]/pricing:inline",
  6: "hidden group-has-[#term-6:checked]/pricing:inline",
  12: "hidden group-has-[#term-12:checked]/pricing:inline",
};

export function PricingTable() {
  return (
    <div className="group/pricing grid gap-8">
      <fieldset className="m-0 grid gap-3 border-0 p-0">
        <legend className="mb-3 type-label">Commitment</legend>
        <div className="inline-flex w-fit flex-wrap gap-1 rounded-pill border border-border bg-surface-sunken p-1">
          {terms.map((t) => (
            <label key={t.months} className="relative">
              <input
                type="radio"
                name="term"
                id={`term-${t.months}`}
                value={t.months}
                defaultChecked={t.months === 1}
                className="peer absolute inset-0 cursor-pointer appearance-none rounded-pill"
              />
              <span className="pointer-events-none flex min-h-11 items-center gap-2 rounded-pill px-4 type-label text-ink-muted transition-colors peer-checked:bg-surface-card peer-checked:text-ink peer-checked:elevation-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring">
                {t.label}
                {t.months !== 1 && (
                  <span className="rounded-pill bg-status-success-bg px-2 py-0.5 type-caption text-status-success">{t.note}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Grid>
        {packages.map((p) => (
          <GridItem key={p.id} span={4} md={p.featured ? 8 : 4} lg={4}>
            <ServiceCard
              title={p.name}
              icon={p.icon}
              description={p.tagline}
              price={terms.map((t) => (
                <span key={t.months} className={visibleWhen[t.months]}>
                  {formatPrice(p.monthlyPrice[t.months], p.currency)}
                </span>
              ))}
              priceUnit="/ month"
              features={[p.hoursPerWeek, ...p.features]}
              featured={p.featured}
              ctaLabel={`Choose ${p.name}`}
              ctaHref={contactHref(p.slug)}
            />
          </GridItem>
        ))}
      </Grid>

      <p className="m-0 max-w-(--container-prose) type-body-sm text-ink-muted">
        Prices in US dollars, billed monthly. 6- and 12-month terms are billed monthly at the lower rate for the length of the
        term. Taxes may apply.
      </p>
    </div>
  );
}
