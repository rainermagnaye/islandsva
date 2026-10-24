import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { appRoutes } from "@/content/routes";
import { ClientProfileView, ClientStatusBadge, ClientStepper } from "@/features/clients/components/client-profile-view";
import { clientRegistrationSteps } from "@/features/clients/contract";
import { getClient } from "@/features/clients/dal";
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
  const client = await getClient(id);
  if (!client) notFound();

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
        <ClientStepper steps={clientRegistrationSteps(client.business)} />
        <ClientProfileView client={client} />
      </div>
    </Workspace>
  );
}
