import { Grid, GridItem } from "@/components/ui/grid";
import { ServiceCard } from "@/components/ui/service-card";
import { formatPrice, packages, startingPrice } from "@/content/packages";
import { contactHref } from "@/content/routes";

/** The three packages as cards, showing the lowest monthly price ("from"). */
export function PackageCards({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  return (
    <Grid>
      {packages.map((p) => (
        <GridItem key={p.id} span={4} md={p.featured ? 8 : 4} lg={4} className="reveal">
          <ServiceCard
            title={p.name}
            icon={p.icon}
            description={p.tagline}
            price={
              <>
                <small className="mr-1 type-body-sm font-sans font-normal text-ink-muted">from</small>
                {formatPrice(startingPrice(p), p.currency)}
              </>
            }
            priceUnit="/ month"
            features={[p.hoursPerWeek, ...p.features.slice(0, 3)]}
            featured={p.featured}
            ctaLabel={`Choose ${p.name}`}
            ctaHref={contactHref(p.slug)}
            headingLevel={headingLevel}
          />
        </GridItem>
      ))}
    </Grid>
  );
}
