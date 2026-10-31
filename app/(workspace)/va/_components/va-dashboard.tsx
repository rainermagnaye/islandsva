import Link from "next/link";
import { Workspace } from "@/components/layout/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { formatDate, partOfDay, wallClockIn } from "@/components/ui/date-math";
import { EmptyState } from "@/components/ui/empty-state";
import { Grid, GridItem } from "@/components/ui/grid";
import { StatCard } from "@/components/ui/stat-card";
import { Stepper } from "@/components/ui/stepper";
import type { Tone } from "@/components/ui/tone";
import { appRoutes } from "@/content/routes";
import { listAssignedClients } from "@/features/clients/assignment-dal";
import { listVaDemos, type VaDemo } from "@/features/demos/booking-dal";
import { VaDemoList } from "@/features/demos/components/va-demo-list";
import { VA_TIME_ZONE } from "@/features/demos/contract";
import { listVaSlots } from "@/features/demos/dal";
import { listWorkingHours } from "@/features/matching/dal";
import { agenda, vaAgendaSources } from "@/features/meetings/agenda";
import { listBookings } from "@/features/meetings/booking-dal";
import { listTasks, listWorkSessions } from "@/features/tasks/dal";
import { performance } from "@/features/tasks/metrics";
import { delayedIds, packageWeek } from "@/features/tasks/time";
import { dueToday, hoursOf, msByClient, trendStart, weeklyFigures } from "@/features/tasks/weekly";
import { ClientClocks } from "./client-clocks";
import { ClientsPanel, HoursByClient } from "./client-hours";
import { TodaySchedule } from "./today-schedule";
import { TodayTasks } from "./today-tasks";

// Weeks in each sparkline, this one included.
const WEEKS = 7;
const TASKS_SHOWN = 6;
const CLIENTS_SHOWN = 5;
const TONES: readonly Tone[] = ["lagoon", "ocean", "sand", "coral"];

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const weekLabel = (monday: string) => formatDate(monday, { month: "short", day: "numeric", timeZone: "UTC" });

/** "Thursday, October 29" and "Good afternoon": the VA works on Manila time, whatever the server's zone. */
function dayline(now: Date) {
  const clock = wallClockIn(now.toISOString(), VA_TIME_ZONE);
  return { date: formatDate(clock.slice(0, 10), { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }), greeting: `Good ${partOfDay(clock)}` };
}

/**
 * The approved VA's dashboard: the week in four numbers, today's tasks and calls, demo requests to answer, and
 * each client's hours. A VA with no clients yet gets the first-week setup instead.
 */
export async function VaDashboard({ vaId, firstName }: { vaId: string; firstName: string }) {
  // Independent reads, in parallel; each runs as the signed-in VA, so RLS applies.
  const [clients, demos, tasks, bookings] = await Promise.all([listAssignedClients(vaId), listVaDemos(vaId), listTasks(), listBookings()]);
  if (clients.length === 0) return <FirstWeek vaId={vaId} firstName={firstName} demos={demos} />;

  const now = new Date();
  const today = dueToday(tasks, now);
  const shown = today.slice(0, TASKS_SHOWN);
  const [recent, todaySessions] = await Promise.all([
    // Enough history for the sparklines; msBetween cuts each session at the week edges.
    listWorkSessions(
      tasks.map((task) => task.id),
      trendStart(VA_TIME_ZONE, now, WEEKS),
    ),
    // Delayed compares a task's whole time with its duration, so these need every session.
    listWorkSessions(shown.map((task) => task.id)),
  ]);

  const weeks = weeklyFigures(tasks, [...recent.values()].flat(), VA_TIME_ZONE, now, WEEKS);
  const [lastWeek, thisWeek] = weeks.slice(-2);
  const labels = weeks.map((week, index) => (index === weeks.length - 1 ? "This week" : weekLabel(week.monday)));
  const overall = performance(tasks, now);
  const week = packageWeek(VA_TIME_ZONE, now);
  const byClient = msByClient(tasks, recent, week.start, week.end, now);
  const clientWeeks = clients.map((client) => ({ ...client, ms: byClient.get(client.id) ?? 0 }));
  const agreed = clients.reduce((sum, client) => sum + (client.hoursPerWeek ?? 0), 0);
  const tones = new Map(clients.map((client, index) => [client.id, TONES[index % TONES.length]]));
  const requests = demos.filter((demo) => demo.status === "pending").length;
  const schedule = agenda(vaAgendaSources({ bookings, demos }), VA_TIME_ZONE, now, 1).filter((item) => item.group === "Today");
  const closedChange = thisWeek.done - lastWeek.done;
  // A sparkline of rates only when every week has one: a missing week is "nothing closed", not 0%.
  const rates = weeks.every((item) => item.onTimeRate !== null) ? weeks.map((item) => Math.round((item.onTimeRate ?? 0) * 100)) : undefined;
  const { date, greeting } = dayline(now);

  return (
    <Workspace
      eyebrow={`${date} · Manila time`}
      title={`${greeting}, ${firstName}`}
      lead={`${plural(today.length, "task", "tasks")} due today and ${plural(requests, "demo request", "demo requests")} waiting for your answer.`}
      actions={<ClientClocks zones={clients.map((client) => client.timezone)} now={now} />}
    >
      <section aria-label="This week" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Hours this week"
          value={hoursOf(thisWeek.ms)}
          unit={agreed > 0 ? `of ${agreed} h` : "h"}
          icon="clock"
          caption={`Agreed across ${plural(clients.length, "client", "clients")}`}
          trend={weeks.map((item) => hoursOf(item.ms))}
          trendLabels={labels}
        />
        <StatCard
          label="Closed this week"
          value={thisWeek.done}
          icon="check"
          href={appRoutes.vaTasks}
          delta={closedChange === 0 ? undefined : { value: String(Math.abs(closedChange)), direction: closedChange > 0 ? "up" : "down" }}
          caption="vs last week"
          trend={weeks.map((item) => item.done)}
          trendLabels={labels}
        />
        <StatCard
          label="On-time rate"
          value={overall.onTimeRate === null ? null : Math.round(overall.onTimeRate * 100)}
          unit="%"
          icon="star"
          caption={overall.onTimeRate === null ? "Needs a closed task" : "Across your closed tasks"}
          trend={rates}
          trendLabels={rates && labels}
        />
        <StatCard label="Overdue" value={overall.overdue} icon="alert-triangle" href={appRoutes.vaTasks} caption="Past the deadline, still with you" />
      </section>

      <Grid>
        {/* Each row's cards stretch to the taller side, so the columns end together; the schedule sits under the
            tasks to balance the demo requests beside them. */}
        <GridItem span={4} md={8} lg={8} className="grid-rows-[auto_1fr] gap-6">
          <TodayTasks tasks={shown} total={today.length} delayed={delayedIds(shown, todaySessions, now)} tones={tones} now={now} />
          <TodaySchedule items={schedule} />
        </GridItem>
        <GridItem span={4} md={8} lg={4}>
          <DemoRequests demos={demos} />
        </GridItem>
        <GridItem span={4} md={8} lg={8}>
          <ClientsPanel clients={clientWeeks.slice(0, CLIENTS_SHOWN)} total={clients.length} now={now} />
        </GridItem>
        <GridItem span={4} md={8} lg={4}>
          <HoursByClient clients={clientWeeks} />
        </GridItem>
      </Grid>
    </Workspace>
  );
}

function DemoRequests({ demos }: { demos: readonly VaDemo[] }) {
  const waiting = demos.filter((demo) => demo.status === "pending").length;
  return (
    <Panel
      boxed
      className="content-start"
      title="Demo requests"
      action={
        waiting > 0 && (
          <Badge tone="warning" size="sm">
            {waiting} waiting
          </Badge>
        )
      }
    >
      <VaDemoList demos={demos} />
    </Panel>
  );
}

const SETUP_STEPS = [
  { label: "Set your working hours", description: "The weekly hours, in Philippine time, when you can take calls.", href: appRoutes.vaHours },
  { label: "Open demo slots", description: "The 30-minute times a client can book a demo call with you.", href: appRoutes.vaCalendar },
  { label: "Get matched with a client", description: "A client books a demo, then an admin confirms the match." },
] as const;

const NEXT_STEP: readonly { label: string; href: string }[] = [
  { label: "Set my working hours", href: appRoutes.vaHours },
  { label: "Open demo slots", href: appRoutes.vaCalendar },
];

/** Before the first client: three setup steps, empty figures and what each section will hold. */
async function FirstWeek({ vaId, firstName, demos }: { vaId: string; firstName: string; demos: readonly VaDemo[] }) {
  const [windows, slots] = await Promise.all([listWorkingHours(vaId), listVaSlots(vaId)]);
  const current = windows.length === 0 ? 0 : slots.length === 0 ? 1 : 2;
  const next = NEXT_STEP[current];

  return (
    <Workspace eyebrow="Your first week" title={`Welcome aboard, ${firstName}`}>
      <Grid>
        <GridItem span={4} md={8} lg={8} className="content-start">
          <Panel
            boxed
            title="Get set up"
            action={
              <Badge tone="info" size="sm">
                Step {current + 1} of {SETUP_STEPS.length}
              </Badge>
            }
          >
            <Stepper label="Setup progress" steps={SETUP_STEPS} current={current} />
            {next && (
              <div className="flex flex-wrap gap-3">
                <Button href={next.href} iconLeft="calendar">
                  {next.label}
                </Button>
              </div>
            )}
          </Panel>
        </GridItem>
        <GridItem span={4} md={8} lg={4} className="content-start">
          <DemoRequests demos={demos} />
        </GridItem>
      </Grid>

      <section aria-label="This week" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Hours this week" value={null} icon="clock" caption="Starts when you log your first hours" />
        <StatCard label="Closed this week" value={null} icon="check" caption="Starts with your first client task" />
        <StatCard label="On-time rate" value={null} icon="star" caption="Needs a closed task" />
        <StatCard label="Active clients" value={0} icon="briefcase" caption="Demos turn into clients here" />
      </section>

      <Panel boxed title="Your clients">
        <EmptyState
          compact
          headingLevel={3}
          title="Your clients appear here"
          description="Once a demo becomes a plan, you'll see each client, their time zone and the hours you've agreed."
          action={
            <Link href={appRoutes.vaCalendar} className="type-label">
              Open your calendar
            </Link>
          }
        />
      </Panel>
    </Workspace>
  );
}
