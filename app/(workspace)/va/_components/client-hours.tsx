import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { CellTitle, DataTable, type Column } from "@/components/ui/data-table";
import { clockLabel, minutesOf, wallClockIn, zoneCity } from "@/components/ui/date-math";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { appRoutes } from "@/content/routes";
import type { AssignedClient } from "@/features/clients/contract";
import { safeTimeZone } from "@/features/demos/contract";
import { hoursOf, hoursStatus } from "@/features/tasks/weekly";

const day = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** A client with the hours the VA logged for them this week. */
export type ClientWeek = AssignedClient & { ms: number };

const hoursText = (client: ClientWeek) => (client.hoursPerWeek ? `${hoursOf(client.ms)} of ${client.hoursPerWeek} h` : `${hoursOf(client.ms)} h`);

function columns(now: Date): Column<ClientWeek>[] {
  return [
    { key: "company", label: "Company", render: (client) => <CellTitle title={client.companyName} subtitle={client.contactName} /> },
    {
      key: "time",
      label: "Their time now",
      nowrap: true,
      render: (client) => {
        if (!client.timezone) return "—";
        const zone = safeTimeZone(client.timezone);
        return `${zoneCity(zone)} · ${clockLabel(minutesOf(wallClockIn(now.toISOString(), zone)))}`;
      },
    },
    { key: "hours", label: "Hours this week", align: "end", nowrap: true, render: hoursText },
    {
      key: "status",
      label: "Status",
      nowrap: true,
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
    { key: "since", label: "Client since", nowrap: true, render: (client) => <span className="text-ink-muted">{day.format(new Date(client.startedAt))}</span> },
  ];
}

/** The VA's clients this week: where they are, the hours logged against what was agreed, and how long they've worked together. */
export function ClientsPanel({ clients, total, now }: { clients: readonly ClientWeek[]; total: number; now: Date }) {
  return (
    <Panel
      boxed
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
    <Panel boxed title="Hours by client">
      {agreed.length === 0 ? (
        <p className="m-0 type-body-sm text-ink-muted">None of your clients has agreed weekly hours yet.</p>
      ) : (
        agreed.map((client) => <ProgressBar key={client.id} label={client.companyName} value={hoursOf(client.ms)} max={client.hoursPerWeek ?? 0} valueText={hoursText(client)} />)
      )}
      <p className="m-0 type-caption text-ink-muted">Hours you logged with the task timer. The week resets Monday, 12 am Manila time.</p>
    </Panel>
  );
}
