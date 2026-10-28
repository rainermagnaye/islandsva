import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { todayIn } from "@/components/ui/date-math";
import { StatCard } from "@/components/ui/stat-card";
import type { Tone } from "@/components/ui/tone";
import { adminUserHref, appRoutes, clientTaskHref, clientVaHref } from "@/content/routes";
import { listActiveAssignments } from "@/features/clients/assignment-dal";
import { getClient, getOwnClientId } from "@/features/clients/dal";
import { getLatestDemo, listClientDemos } from "@/features/demos/booking-dal";
import { ClientDemoCard } from "@/features/demos/components/client-demo-card";
import { demoState } from "@/features/demos/contract";
import { agenda, clientAgendaSources } from "@/features/meetings/agenda";
import { listBookings } from "@/features/meetings/booking-dal";
import { BOOKING_TIME_ZONE } from "@/features/meetings/contract";
import { AddTaskButton } from "@/features/tasks/components/add-task-button";
import { ReviewBanner } from "@/features/tasks/components/review-banner";
import { TASK_STATUS_LABELS, TASK_STATUS_TONES, type Task } from "@/features/tasks/contract";
import { getOwnCompany, listTasks } from "@/features/tasks/dal";
import { deadlineWindow, isOverdue, sortTasks, taskTimeZone } from "@/features/tasks/metrics";
import { dashboardFigures, datedTasks, reviewQueue, taskLine, vaWork } from "@/features/tasks/team";
import { employeeHasAvatar } from "@/features/users/employee-dal";
import { requireRole } from "@/lib/auth/session";
import { DashboardTasks, type DashboardTask } from "./_components/dashboard-tasks";
import { ComingUpCard, TeamCard, type TeamMember } from "./_components/dashboard-side";
import { greeting, longDay } from "./_components/greeting";

export const metadata: Metadata = { title: "Dashboard" };

const TONES: readonly Tone[] = ["lagoon", "ocean", "sand", "coral"];
/** Recently closed tasks the dashboard shows; the rest are on the Tasks page. */
const CLOSED_SHOWN = 6;
/** "Coming up" shows the next few things in the coming week. */
const NEXT_SHOWN = 3;

export default function ClientHomePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ClientHome />
    </Suspense>
  );
}

async function ClientHome() {
  const user = await requireRole(["client"]);
  // RLS: a client reads only their own record, its assignments, tasks, meetings and demo calls.
  const clientId = await getOwnClientId(user.id);
  const client = clientId ? await getClient(clientId) : null;
  if (!client) {
    return (
      <Workspace title="Dashboard">
        <ComingSoon title="Your account is being set up">Your Islands VA contact is finishing your setup. Check back soon, or reply to their email.</ComingSoon>
      </Workspace>
    );
  }

  const [assignments, company, tasks, bookings, clientDemos] = await Promise.all([
    listActiveAssignments(client.id),
    getOwnCompany(user.id),
    listTasks(),
    listBookings(),
    listClientDemos(client.id),
  ]);
  const [photos, latestDemo] = await Promise.all([
    Promise.all(assignments.map((assignment) => employeeHasAvatar(assignment.vaId))),
    assignments.length === 0 ? getLatestDemo(client.id) : Promise.resolve(null),
  ]);

  const now = new Date();
  const zone = taskTimeZone(company?.timezone);
  const window = deadlineWindow(zone);
  const canCreate = assignments.length > 0 && company?.status === "active" && company.disabledAt === null && window !== null;
  const figures = dashboardFigures(tasks, zone, now);
  const waiting = reviewQueue(tasks);

  // Each assistant's tone and photo, shared by their task rows and their line in "My assistants".
  const people = new Map(
    assignments.map((assignment, index) => [
      assignment.vaId,
      { tone: TONES[index % TONES.length], photoSrc: photos[index] ? `${adminUserHref(assignment.vaId)}/avatar` : undefined },
    ]),
  );
  const row = (task: Task, group: DashboardTask["group"]): DashboardTask => {
    const late = isOverdue(task, now);
    return {
      id: task.id,
      title: task.title,
      href: clientTaskHref(task.id),
      va: task.vaFirstName,
      tone: people.get(task.vaId)?.tone ?? "lagoon",
      photoSrc: people.get(task.vaId)?.photoSrc,
      line: taskLine(task, zone, now),
      late,
      status: late ? { label: "Overdue", tone: "danger" } : { label: TASK_STATUS_LABELS[task.status], tone: TASK_STATUS_TONES[task.status] },
      group,
    };
  };
  const closed = tasks
    .filter((task) => task.status === "done")
    .sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""))
    .slice(0, CLOSED_SHOWN);
  const taskRows = [
    ...sortTasks(tasks.filter((task) => task.status === "todo" || task.status === "in_progress")).map((task) => row(task, "open")),
    ...waiting.map((task) => row(task, "review")),
    ...closed.map((task) => row(task, "closed")),
  ];

  const demos = clientDemos.flatMap((demo) => {
    const state = demoState(demo, now);
    return state === "pending" || state === "confirmed" ? [{ id: demo.id, vaName: demo.vaName, startsAt: demo.startsAt, endsAt: demo.endsAt, state, href: appRoutes.clientMatch }] : [];
  });
  const dated = datedTasks(tasks, now).map(({ task, at, overdue }) => ({
    id: task.id,
    title: task.title,
    vaFirstName: task.vaFirstName,
    at,
    status: task.status,
    overdue,
    href: clientTaskHref(task.id),
  }));
  // Overdue work is already on the Overdue card, so "Coming up" is only what's ahead this week.
  const next = agenda(clientAgendaSources({ bookings, tasks: dated, demos }), BOOKING_TIME_ZONE, now, 7)
    .filter((item) => item.group !== "Overdue")
    .slice(0, NEXT_SHOWN);

  const team: TeamMember[] = assignments.map((assignment) => {
    const work = vaWork(tasks, assignment.vaId, zone, now);
    const late = tasks.filter((task) => task.vaId === assignment.vaId && isOverdue(task, now)).length;
    const parts = [work.open > 0 ? `${work.open} open` : null, work.review > 0 ? `${work.review} in review` : null].filter(Boolean);
    return {
      id: assignment.vaId,
      name: assignment.vaName.trim().split(/\s+/)[0] || assignment.vaName,
      href: clientVaHref(assignment.vaId),
      tone: people.get(assignment.vaId)?.tone ?? "lagoon",
      photoSrc: people.get(assignment.vaId)?.photoSrc,
      work: parts.length > 0 ? parts.join(" · ") : "Nothing open",
      flag: late > 0 ? { label: `${late} overdue`, tone: "danger" } : work.review > 0 ? { label: "To review", tone: "warning" } : null,
    };
  });

  const latest = figures.latest;
  return (
    <Workspace
      title={greeting(now, zone)}
      lead={`${company?.companyName ?? client.companyName} · ${longDay(now, zone)}`}
      actions={canCreate && window ? <AddTaskButton vas={team.map((member) => ({ id: member.id, firstName: member.name }))} today={window.today} last={window.last} timeZone={zone} /> : undefined}
    >
      <ReviewBanner count={waiting.length} href={waiting[0] ? clientTaskHref(waiting[0].id) : appRoutes.clientTasks} />

      <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open tasks"
          value={figures.open}
          icon="clock"
          href={appRoutes.clientTasks}
          caption={figures.dueThisWeek > 0 ? `${figures.dueThisWeek} due this week` : figures.open > 0 ? "None due this week" : "Nothing open"}
        />
        <StatCard label="Waiting for you" value={figures.review} icon="inbox" caption="Submitted for review" />
        <StatCard
          label="Overdue"
          value={figures.overdue}
          icon="alert"
          caption={figures.overdue === 0 || !latest ? "All on track" : figures.overdue === 1 ? `${latest.vaFirstName} · ${taskLine(latest, zone, now).split(" · ")[1] ?? "late"}` : "Past their deadline"}
        />
        <StatCard
          label="Closed this month"
          value={figures.closedThisMonth}
          icon="check-circle"
          caption={figures.onTimeRate === null ? "In your time zone" : `${Math.round(figures.onTimeRate * 100)}% on time`}
        />
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[999_1_35rem]">
          <DashboardTasks
            tasks={taskRows}
            allHref={appRoutes.clientTasks}
            emptyOpen={assignments.length === 0 ? { title: "No tasks yet", body: "Once a VA is working with you, add a task and they'll pick it up." } : undefined}
          />
        </div>
        <aside aria-label="Your week" className="grid min-w-0 flex-[1_1_18rem] gap-5 lg:max-w-[23.75rem]">
          <ComingUpCard items={next} today={todayIn(BOOKING_TIME_ZONE, now)} calendarHref={appRoutes.clientCalendar} />
          <TeamCard team={team} allHref={appRoutes.clientAssistants} empty={<ClientDemoCard demo={latestDemo} timeZone={client.timezone} />} />
        </aside>
      </div>
    </Workspace>
  );
}
