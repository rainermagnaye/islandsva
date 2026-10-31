import Link from "next/link";
import { Panel } from "@/components/ui/card";
import { CellTitle, DataTable, type Column } from "@/components/ui/data-table";
import { clockLabel, minutesOf, wallClockIn, zoneCity } from "@/components/ui/date-math";
import { EmptyState } from "@/components/ui/empty-state";
import { appRoutes, vaClientHref } from "@/content/routes";
import type { AssignedClient } from "@/features/clients/contract";
import { safeTimeZone } from "@/features/demos/contract";

function columns(now: Date): Column<AssignedClient>[] {
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
    // Agreed hours only: hours worked come with timesheets (M14).
    {
      key: "hours",
      label: "Agreed",
      align: "end",
      width: "18%",
      render: (client) => (client.hoursPerWeek ? `${client.hoursPerWeek} h a week` : <span className="text-ink-muted">Not set</span>),
    },
  ];
}

/** The VA's clients: their time now and the weekly hours agreed. The Clients page has the rest. */
export function ClientsPanel({ clients, total, now }: { clients: readonly AssignedClient[]; total: number; now: Date }) {
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
