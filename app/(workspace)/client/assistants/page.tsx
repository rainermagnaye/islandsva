import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { clockLabel, formatDate, minutesOf } from "@/components/ui/date-math";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import type { Tone } from "@/components/ui/tone";
import { packages } from "@/content/packages";
import { adminUserHref, appRoutes, clientTaskHref, clientVaHref } from "@/content/routes";
import { listActiveAssignments } from "@/features/clients/assignment-dal";
import { AssistantCard, type AssistantView } from "@/features/clients/components/assistant-card";
import { VaMessageButton } from "@/features/clients/components/va-message-button";
import { getClient, getOwnClientId } from "@/features/clients/dal";
import { listVaMessages } from "@/features/clients/message-dal";
import { getLatestDemo } from "@/features/demos/booking-dal";
import { ClientDemoCard } from "@/features/demos/components/client-demo-card";
import { AddTaskButton } from "@/features/tasks/components/add-task-button";
import { ReviewBanner } from "@/features/tasks/components/review-banner";
import { getOwnCompany, listTasks } from "@/features/tasks/dal";
import { deadlineWindow, relativeDay, taskTimeZone } from "@/features/tasks/metrics";
import { reviewQueue, vaWork } from "@/features/tasks/team";
import { employeeHasAvatar } from "@/features/users/employee-dal";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My assistants" };

/** Every VA works Philippine hours. */
const VA_TIME_ZONE = "Asia/Manila";
const TONES: readonly Tone[] = ["lagoon", "ocean", "sand", "coral"];

export default function ClientAssistantsPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ClientAssistants />
    </Suspense>
  );
}

async function ClientAssistants() {
  const user = await requireRole(["client"]);
  // RLS: a client reads only their own record, its assignments, tasks and messages.
  const clientId = await getOwnClientId(user.id);
  const client = clientId ? await getClient(clientId) : null;
  if (!client) {
    return (
      <Workspace title="My assistants">
        <ComingSoon title="Your account is being set up">Your Islands VA contact is finishing your setup. Check back soon, or reply to their email.</ComingSoon>
      </Workspace>
    );
  }

  const [assignments, company, tasks] = await Promise.all([listActiveAssignments(client.id), getOwnCompany(user.id), listTasks()]);

  if (assignments.length === 0) {
    const demo = await getLatestDemo(client.id);
    return (
      <Workspace title="My assistants">
        <EmptyState
          title="No assistant yet"
          description="Pick from the VAs we've matched to you. Your VA shows up here once you accept."
          action={
            <Button href={appRoutes.clientMatch} iconLeft="star">
              See your matches
            </Button>
          }
        />
        <Card>
          <ClientDemoCard demo={demo} timeZone={client.timezone} />
        </Card>
      </Workspace>
    );
  }

  const [photos, messages] = await Promise.all([
    Promise.all(assignments.map((assignment) => employeeHasAvatar(assignment.vaId))),
    Promise.all(assignments.map((assignment) => listVaMessages(client.id, assignment.vaId))),
  ]);

  const now = new Date();
  const zone = taskTimeZone(company?.timezone);
  const window = deadlineWindow(zone);
  const canCreate = company?.status === "active" && company.disabledAt === null && window !== null;
  const pkg = packages.find((item) => item.slug === client.packageCode);
  const hours = client.hoursPerWeek || pkg?.weeklyHours || 0;
  const plan = [pkg?.name ?? "Package once it's confirmed", hours ? `${hours} hrs a week` : null].filter(Boolean).join(" · ");
  const clock = localTimes(now, zone);
  const sent = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: zone });

  const cards = assignments.map((assignment, index) => {
    const name = firstName(assignment.vaName);
    const work = vaWork(tasks, assignment.vaId, zone, now);
    const view: AssistantView = {
      id: assignment.vaId,
      name,
      href: clientVaHref(assignment.vaId),
      photoSrc: photos[index] ? `${adminUserHref(assignment.vaId)}/avatar` : undefined,
      tone: TONES[index % TONES.length],
      plan,
      clock,
      open: work.open,
      review: work.review,
      closed: work.closedThisMonth,
      next: work.next
        ? { title: work.next.title, href: clientTaskHref(work.next.id), due: `${relativeDay(work.next.deadline, work.next.deadlineTimezone, now)} · ${dueLabel(work.next)}`, overdue: work.nextOverdue }
        : null,
    };
    const notes = messages[index].map((message) => ({
      id: message.id,
      body: message.body,
      sent: sent.format(new Date(message.createdAt)),
      author: message.authorId === user.id ? "You" : name,
    }));
    return { view, notes, work };
  });

  const waiting = reviewQueue(tasks);
  const open = cards.reduce((sum, card) => sum + card.work.open, 0);
  const closed = cards.reduce((sum, card) => sum + card.work.closedThisMonth, 0);
  const formVas = assignments.map((assignment) => ({ id: assignment.vaId, firstName: firstName(assignment.vaName) }));

  return (
    <Workspace
      title="My assistants"
      actions={
        <>
          <Button href={appRoutes.clientMatch} variant="ghost" iconLeft="star">
            Find another VA
          </Button>
          {canCreate && window && <AddTaskButton vas={formVas} today={window.today} last={window.last} timeZone={zone} />}
        </>
      }
    >

      <ReviewBanner count={waiting.length} href={waiting[0] ? clientTaskHref(waiting[0].id) : appRoutes.clientTasks} />

      <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assistants" value={assignments.length} icon="users" caption={plan} />
        <StatCard label="Open tasks" value={open} icon="clock" caption="With your VAs" />
        <StatCard label="Waiting for you" value={waiting.length} icon="inbox" caption="Submitted for review" />
        <StatCard label="Closed this month" value={closed} icon="check-circle" caption="In your time zone" />
      </section>

      <section aria-labelledby="your-team" className="grid gap-4">
        <h2 id="your-team" className="m-0 type-h4">
          Your team <span className="font-medium text-ink-muted">· {assignments.length}</span>
        </h2>
        <ul className="m-0 grid list-none gap-5 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,21rem),1fr))]">
          {cards.map(({ view, notes }) => (
            <AssistantCard
              key={view.id}
              va={view}
              actions={
                <>
                  <VaMessageButton name={view.name} vaId={view.id} messages={notes} compact />
                  {canCreate && window && <AddTaskButton va={{ id: view.id, firstName: view.name }} today={window.today} last={window.last} timeZone={zone} variant="secondary" size="sm" />}
                </>
              }
            />
          ))}
        </ul>
      </section>
    </Workspace>
  );
}

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || full;
}

function dueLabel(task: { deadline: string; deadlineTime: string | null }) {
  const day = formatDate(task.deadline, { month: "short", day: "numeric" });
  return task.deadlineTime ? `${day}, ${clockLabel(minutesOf(task.deadlineTime))}` : day;
}

/** "10:54 AM in Manila, 10:54 PM for you", or just Manila's time when the client is in the same zone. */
function localTimes(now: Date, clientZone: string) {
  const clock = (timeZone: string) => new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone }).format(now);
  const manila = `${clock(VA_TIME_ZONE)} in Manila`;
  return clientZone === VA_TIME_ZONE ? manila : `${manila}, ${clock(clientZone)} for you`;
}
