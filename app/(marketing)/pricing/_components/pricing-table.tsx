import { Grid, GridItem } from "@/components/ui/grid";
import { ServiceCard } from "@/components/ui/service-card";
import { amountDue, formatPrice, packages, paidUpfront, termSavings, terms, type SubscriptionTerm } from "@/content/packages";
import { contactHref } from "@/content/routes";

// Every term's price is in the HTML; radio inputs + :has() show the selected one. Zero JavaScript.
const visibleWhen: Record<SubscriptionTerm, string> = {
  1: "hidden group-has-[#term-1:checked]/pricing:block",
  6: "hidden group-has-[#term-6:checked]/pricing:block",
  12: "hidden group-has-[#term-12:checked]/pricing:block",
};

const unitClass = "ml-1 type-body-sm font-sans font-normal text-ink-muted";

/** Monthly shows the price a month. 6 and 12 months show the one upfront payment, then the monthly rate and saving. */
function TermPrice({ slug, monthly, months }: { slug: string; monthly: number; months: SubscriptionTerm }) {
  if (!paidUpfront(months)) {
    return (
      <>
        {formatPrice(monthly)}
        <small className={unitClass}>/ month</small>
      </>
    );
  }
  const saving = termSavings(slug, monthly, months);
  return (
    <>
      {formatPrice(amountDue(monthly, months))}
      <small className={unitClass}>{`/ ${months} months, paid upfront`}</small>
      <span className="mt-1 block type-body-sm font-sans font-normal text-ink-muted">
        {`${formatPrice(monthly)} / month, save ${formatPrice(saving.perMonth)} a month`}
      </span>
    </>
  );
}

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
                  <TermPrice slug={p.slug} monthly={p.monthlyPrice[t.months]} months={t.months} />
                </span>
              ))}
              features={[p.hoursPerWeek, ...p.features]}
              featured={p.featured}
              ctaLabel={`Choose ${p.name}`}
              ctaHref={contactHref(p.slug)}
            />
          </GridItem>
        ))}
      </Grid>

      <p className="m-0 max-w-(--container-prose) type-body-sm text-ink-muted">
        Prices in US dollars. Monthly is billed each month. 6- and 12-month terms are one payment, made upfront for the whole
        term at the lower monthly rate. Taxes may apply.
      </p>
    </div>
  );
}
