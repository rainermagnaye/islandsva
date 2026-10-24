import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { appRoutes } from "@/content/routes";
import { ClientProfileView, ClientStatusBadge, ClientStepper } from "@/features/clients/components/client-profile-view";
import { listPayments } from "@/features/clients/activation-dal";
import { ActivationPanel } from "@/features/clients/components/activation-panel";
import { OnboardingPanel } from "@/features/clients/components/onboarding-panel";
import { clientRegistrationSteps, progressOf } from "@/features/clients/contract";
import { getClient } from "@/features/clients/dal";
import { getOnboardingStatus } from "@/features/clients/onboarding-dal";
import { parseClientId } from "@/features/clients/validation";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Client" };

export default function CloserClientPage({ params }: PageProps<"/closer/clients/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <CloserClient params={params} />
    </Suspense>
  );
}

async function CloserClient({ params }: Pick<PageProps<"/closer/clients/[id]">, "params">) {
  await requireRole(["closer"]);
  const { id } = await params;
  if (!parseClientId({ clientId: id }).ok) notFound();
  // RLS: a Closer reads only the clients they created, so anyone else's id is a 404.
  const [client, onboarding, payments] = await Promise.all([getClient(id), getOnboardingStatus(id), listPayments(id)]);
  if (!client || !onboarding) notFound();

  return (
    <Workspace
      compact
      breadcrumbs={<Breadcrumbs items={[{ label: "Your clients", href: appRoutes.closer }, { label: client.companyName }]} />}
    >
      <div className="grid gap-4">
        <Card as="header" padding="sm" className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 min-w-0 truncate type-h3">
            {client.contactName}
            <span className="font-normal"> - {client.companyName}</span>
          </h1>
          <ClientStatusBadge status={client.status} disabledAt={client.disabledAt} />
        </Card>
        <ClientStepper steps={clientRegistrationSteps(client.business, progressOf(client, payments))} />
        <OnboardingPanel clientId={client.id} status={onboarding} canSend={client.status === "pending" && !client.disabledAt} />
        <ActivationPanel client={client} payments={payments} />
        <ClientProfileView client={client} />
      </div>
    </Workspace>
  );
}
