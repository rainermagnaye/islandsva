import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { appRoutes } from "@/content/routes";
import { ClientProfileView, ClientStatusBadge, ClientStepper } from "@/features/clients/components/client-profile-view";
import { OnboardingLinkCard } from "@/features/clients/components/onboarding-link";
import { clientRegistrationSteps } from "@/features/clients/registration";
import { getClient } from "@/features/clients/dal";
import { onboardingUrl, registrationOrigin } from "@/features/clients/link";
import { getRegistrationToken } from "@/features/clients/onboarding-dal";
import { parseClientId } from "@/features/clients/validation";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Client" };

export default function LeadgenClientPage({ params }: PageProps<"/leadgen/clients/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <LeadgenClient params={params} />
    </Suspense>
  );
}

async function LeadgenClient({ params }: Pick<PageProps<"/leadgen/clients/[id]">, "params">) {
  await requireRole(["closer"]);
  const { id } = await params;
  if (!parseClientId({ clientId: id }).ok) notFound();
  const client = await getClient(id);
  if (!client) notFound();
  // The token is server-only; read it only after this client is visible to the Lead Gen.
  const awaitingRegistration = client.status === "pending" && !client.disabledAt;
  const token = awaitingRegistration ? await getRegistrationToken(id) : null;
  const url = token ? onboardingUrl(token, await registrationOrigin()) : null;

  return (
    <Workspace
      compact
      breadcrumbs={<Breadcrumbs items={[{ label: "Clients", href: appRoutes.leadgenClients }, { label: client.companyName }]} />}
    >
      <div className="grid gap-4">
        <Card as="header" padding="sm" className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 min-w-0 truncate type-h3">
            {client.contactName}
            <span className="font-normal"> - {client.companyName}</span>
          </h1>
          <ClientStatusBadge status={client.status} disabledAt={client.disabledAt} />
        </Card>
        <ClientStepper steps={clientRegistrationSteps({ onboardingStatus: client.onboardingStatus, accountStatus: client.status })} />
        {awaitingRegistration && <OnboardingLinkCard clientId={client.id} url={url} />}
        <ClientProfileView client={client} />
      </div>
    </Workspace>
  );
}
