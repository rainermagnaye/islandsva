import { Card } from "@/components/ui/card";
import { formatPackagePrice } from "@/content/currencies";
import { packages, terms } from "@/content/packages";
import { payment } from "@/content/payment";
import { timezoneForCountry } from "@/content/timezones";
import type { PublicOnboarding } from "../contract";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/**
 * The package agreed at conversion. The amount cannot be changed from this link. `showPayment` adds how to pay
 * (the payment step only; once the receipt is in, the client doesn't need it again).
 */
export function OnboardingSummary({
  packet,
  showPayment = false,
}: {
  packet: Pick<PublicOnboarding, "packageCode" | "termMonths" | "monthlyCents" | "startsOn" | "business">;
  showPayment?: boolean;
}) {
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
      {showPayment && (
        <div className="grid gap-3 border-t border-border pt-3">
          <h3 className="m-0 type-label">Payment</h3>
          <p className="m-0 type-body-sm text-ink-muted">
            Pay the monthly amount above with {payment.provider}: scan the QR code or open the payment link. Then upload a PDF or photo of the receipt.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- a 35 KB QR served as-is; resizing could blur the code */}
            <img src={payment.qr} alt={`${payment.provider} QR code to pay ${payment.payee}`} width={160} height={160} className="size-40 rounded-md" />
            <dl className="m-0 grid min-w-0 flex-1 basis-48 gap-3">
              <div>
                <dt className="type-caption text-ink-muted">Pay to</dt>
                <dd className="m-0 type-body-sm">
                  {payment.payee} ({payment.handle})
                </dd>
              </div>
              <div>
                <dt className="type-caption text-ink-muted">Payment link</dt>
                <dd className="m-0 type-body-sm break-all">
                  <a href={payment.url} target="_blank" rel="noopener noreferrer">
                    {payment.url.replace(/^https:\/\//, "")}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </Card>
  );
}
