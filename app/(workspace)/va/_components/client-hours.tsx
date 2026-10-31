import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { CellTitle, DataTable, type Column } from "@/components/ui/data-table";
import { clockLabel, minutesOf, wallClockIn, zoneCity } from "@/components/ui/date-math";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { appRoutes, vaClientHref } from "@/content/routes";
import type { AssignedClient } from "@/features/clients/contract";
import { safeTimeZone } from "@/features/demos/contract";
import { hoursOf, hoursStatus } from "@/features/tasks/weekly";

/** A client with the hours the VA logged for them this week. */
export type ClientWeek = AssignedClient & { ms: number };

const hoursText = (client: ClientWeek) => (client.hoursPerWeek ? `${hoursOf(client.ms)} of ${client.hoursPerWeek} h` : `${hoursOf(client.ms)} h`);

function columns(now: Date): Column<ClientWeek>[] {
  return [
    {
      key: "company",
      label: "Company",
      // One line each, cut with an ellipsis; the full name is in the tooltip.
      render: (client) => (
        <CellTitle
          title={
            // The row link stretches across the whole row, so any cell opens the client's profile.
            <Link href={vaClientHref(client.id)} className="row-link" title={client.companyName}>
              {client.companyName}
            </Link>
          }
          subtitle={
            <span className="block truncate" title={client.contactName}>
              {client.contactName}
            </span>
          }
        />
      ),
    },
    // Shares, not fixed widths: the panel is two-thirds of the page, so fixed tracks left the company a sliver on
    // smaller screens. The time stacks over the city to stay narrow.
    {
      key: "time",
      label: "Their time",
      width: "18%",
      render: (client) => {
        if (!client.timezone) return "—";
        const zone = safeTimeZone(client.timezone);
        return <CellTitle title={clockLabel(minutesOf(wallClockIn(now.toISOString(), zone)))} subtitle={zoneCity(zone)} />;
      },
    },
    { key: "hours", label: "This week", align: "end", width: "18%", render: hoursText },
    {
      key: "status",
      label: "Status",
      width: "22%",
      render: (client) => {
        const status = hoursStatus(client.ms, client.hoursPerWeek);
        return status ? (
          <Badge tone={status.tone} size="sm">
            {status.label}
          </Badge>
        ) : (
          <span className="text-ink-muted">No agreed hours</span>
        );
      },
    },
  ];
}

/** The VA's clients this week: their time now and the hours logged against what was agreed. The Clients page has the rest. */
export function ClientsPanel({ clients, total, now }: { clients: readonly ClientWeek[]; total: number; now: Date }) {
  return (
    <Panel
      boxed
      className="content-start"
      title="Your clients"
      action={
        total > clients.length && (
          <Link href={appRoutes.vaClients} className="type-label">
            All {total} clients
          </Link>
        )
      }
    >
      <DataTable
        caption="Your clients"
        columns={columns(now)}
        rows={clients}
        rowKey={(client) => client.id}
        selectable={false}
        empty={<EmptyState compact headingLevel={3} title="No clients yet" description="An admin assigns clients to you. They'll show here once you're matched." />}
      />
    </Panel>
  );
}

/** One bar per client with agreed hours. Warning from 85%, danger at the limit, the number always in words. */
export function HoursByClient({ clients }: { clients: readonly ClientWeek[] }) {
  const agreed = clients.filter((client) => client.hoursPerWeek);
  return (
    <Panel boxed className="content-start" title="Hours by client">
      {agreed.length === 0 ? (
        <p className="m-0 type-body-sm text-ink-muted">None of your clients has agreed weekly hours yet.</p>
      ) : (
        agreed.map((client) => <ProgressBar key={client.id} label={client.companyName} value={hoursOf(client.ms)} max={client.hoursPerWeek ?? 0} valueText={hoursText(client)} />)
      )}
      <p className="m-0 type-caption text-ink-muted">Hours you logged with the task timer. The week resets Monday, 12 am Manila time.</p>
    </Panel>
  );
}
