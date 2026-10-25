import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPackagePrice } from "@/content/currencies";
import { packages, terms } from "@/content/packages";
import { timezoneForCountry } from "@/content/timezones";
import type { PublicOnboarding } from "../contract";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** The package agreed at conversion. The amount cannot be changed from this link. */
export function OnboardingSummary({ packet }: { packet: PublicOnboarding }) {
  const pkg = packages.find((item) => item.slug === packet.packageCode);
  const term = terms.find((item) => item.months === packet.termMonths);
  const zone = timezoneForCountry(packet.business.country)?.label ?? "";
  const price = packet.monthlyCents ? formatPackagePrice(packet.monthlyCents, packet.business.country) : null;

  return (
    <Card as="section" padding="md" className="grid gap-3">
      <h2 className="m-0 type-label">Package</h2>
      <p className="m-0 type-body text-ink">
        {pkg && term && price ? `${pkg.name}, ${pkg.hoursPerWeek}, ${term.label.toLowerCase()} at ${price} a month.` : "The monthly amount will be confirmed by the team."}
      </p>
      <dl className="m-0 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="type-caption text-ink-muted">Start date</dt>
          <dd className="m-0 type-body-sm">{packet.startsOn ? day.format(new Date(`${packet.startsOn.slice(0, 10)}T00:00:00Z`)) : "Not set"}</dd>
        </div>
        <div>
          <dt className="type-caption text-ink-muted">Time zone</dt>
          <dd className="m-0 type-body-sm">{zone || "Not set"}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 type-label">Payment</h3>
        <Badge tone="warning" size="sm" icon={null}>
          Sample
        </Badge>
      </div>
      <p className="m-0 type-body-sm text-ink-muted">These payment instructions are a sample. Transfer the monthly amount above, then upload a PDF or photo of the receipt.</p>
    </Card>
  );
}
