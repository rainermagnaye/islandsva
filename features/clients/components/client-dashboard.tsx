import type { ReactNode } from "react";
import { Card, Panel } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { formatPrice, packages, terms } from "@/content/packages";
import type { ClientDetail } from "../contract";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

/** The client's dashboard: their VA (or, before one, their demo call) and their package. Server-rendered. */
export function ClientDashboard({ client, va, beforeVa }: { client: ClientDetail; va: { firstName: string | null; startedAt: string } | null; beforeVa: ReactNode }) {
  const pkg = packages.find((item) => item.slug === client.packageCode);
  const term = terms.find((item) => item.months === client.termMonths);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Panel title="Your VA">
        {va ? (
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-pill bg-status-info-bg text-action-secondary" aria-hidden="true">
              <Icon name="user" />
            </span>
            <div className="grid">
              <span className="type-label">{va.firstName ?? "Your VA"}</span>
              <span className="type-body-sm text-ink-muted">Working with you since {day.format(new Date(va.startedAt))}</span>
            </div>
          </div>
        ) : (
          beforeVa
        )}
      </Panel>

      <Panel title="Your package">
        {pkg ? (
          <dl className="m-0 grid gap-3 sm:grid-cols-2">
            <Detail label="Package" value={pkg.name} />
            <Detail label="Time" value={pkg.hoursPerWeek} />
            <Detail label="Term" value={term?.label ?? "—"} />
            <Detail label="Monthly" value={client.monthlyCents ? formatPrice(client.monthlyCents) : "—"} />
            <Detail label="Starts" value={client.startsOn ? day.format(new Date(client.startsOn)) : "—"} />
          </dl>
        ) : (
          <p className="m-0 type-body-sm text-ink-muted">Your package details will show here once they&apos;re confirmed.</p>
        )}
      </Panel>

      <Card padding="sm" className="lg:col-span-2">
        <p className="m-0 type-body-sm text-ink-muted">Questions about your plan or your VA? Reply to any email from your Islands VA contact and we&apos;ll help.</p>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="type-caption text-ink-muted">{label}</dt>
      <dd className="m-0 type-body-sm text-ink">{value}</dd>
    </div>
  );
}
