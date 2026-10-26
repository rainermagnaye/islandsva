import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { appRoutes } from "@/content/routes";
import { listAssignedClients } from "@/features/clients/assignment-dal";
import { AssignedClientsTable } from "@/features/clients/components/assigned-clients-table";
import { listVaDemos } from "@/features/demos/booking-dal";
import { VaDemoList } from "@/features/demos/components/va-demo-list";
import { LazyVaRegistration } from "@/features/users/components/lazy-va-registration";
import { employeeAccessBadge } from "@/features/users/contract";
import { loadVaAccess } from "@/features/users/service";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "VA workspace" };

export default function VaHomePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <VaHome />
    </Suspense>
  );
}

async function VaHome() {
  const user = await requireRole(["va"]);
  const access = await loadVaAccess(user.id);
  if (access.open) return <VaDashboard vaId={user.id} />;
  if (!access.account) return <Workspace title="Dashboard" />;
  const account = access.account;
  const review = access.profile?.reviewStatus ?? "pending";
  const badge = employeeAccessBadge({ roles: account.roles, accountStatus: account.status, review: access.profile?.reviewStatus ?? null, signedIn: account.signedInAt !== null });

  return (
    <Container className="grid gap-4 py-10 md:py-12">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 type-h1">Your profile</h1>
          <Badge tone={badge.tone} size="sm">{badge.label}</Badge>
        </div>
        {review !== "pending_review" && (
          <p className="m-0 max-w-[60ch] text-ink-muted">Fill in every section, then send it for review. The rest of the workspace opens once we confirm the profile.</p>
        )}
      </div>
      {review === "pending_review" && (
        <Alert tone="info" title="An admin will review your details">
          We&apos;ll open the rest of the workspace once the profile is confirmed.
        </Alert>
      )}
      {access.profile?.returnNote && access.profile.reviewStatus === "pending" && (
        <Alert tone="warning" title="A few details need a change">
          {access.profile.returnNote}
        </Alert>
      )}
      <LazyVaRegistration user={access.account} profile={access.profile} />
    </Container>
  );
}

const RECENT = 5;

/** The approved VA's dashboard: demo requests to answer, upcoming calls, clients and weekly hours. */
async function VaDashboard({ vaId }: { vaId: string }) {
  // Independent reads, in parallel; both run as the signed-in VA, so RLS applies.
  const [clients, demos] = await Promise.all([listAssignedClients(vaId), listVaDemos(vaId)]);
  const requests = demos.filter((demo) => demo.status === "pending").length;
  const hours = clients.reduce((sum, client) => sum + (client.hoursPerWeek ?? 0), 0);

  return (
    <Workspace title="Dashboard" lead="Demo requests, your clients and hours at a glance.">
      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Demo requests" value={requests} icon="bell" caption="Waiting for your answer" />
        <StatCard label="Upcoming demos" value={demos.length - requests} icon="calendar" href={appRoutes.vaCalendar} />
        <StatCard label="Active clients" value={clients.length} icon="briefcase" href={appRoutes.vaClients} />
        <StatCard label="Hours per week" value={hours} unit="h" icon="clock" caption="Agreed across your clients" />
      </section>

      <Panel title="Demo calls" action={<Link href={appRoutes.vaCalendar} className="type-label">Calendar</Link>}>
        <VaDemoList demos={demos} />
      </Panel>

      <Panel
        title="Your clients"
        action={
          clients.length > RECENT && (
            <Link href={appRoutes.vaClients} className="type-label">
              All clients
            </Link>
          )
        }
      >
        <AssignedClientsTable
          caption="Your clients"
          clients={clients.slice(0, RECENT)}
          empty={<EmptyState compact title="No clients yet" description="An admin assigns clients to you. They'll show here once you're matched." />}
        />
      </Panel>
    </Workspace>
  );
}
