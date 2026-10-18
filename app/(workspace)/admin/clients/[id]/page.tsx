import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { appRoutes } from "@/content/routes";
import { clientProfileTab } from "@/features/clients/contract";
import { ClientProfile } from "@/features/clients/components/client-profile";
import { getClient, listClientNotes } from "@/features/clients/dal";
import { parseClientId } from "@/features/clients/validation";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Client" };

export default function ClientProfilePage({ params, searchParams }: PageProps<"/admin/clients/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Client params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Client({ params, searchParams }: Pick<PageProps<"/admin/clients/[id]">, "params" | "searchParams">) {
  await requireRole(["admin"]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!parseClientId({ clientId: id }).ok) notFound();
  const [client, notes] = await Promise.all([getClient(id), listClientNotes(id)]);
  if (!client) notFound();

  return (
    <Workspace
      compact
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Admin", href: appRoutes.admin },
            { label: "Clients", href: appRoutes.adminClients },
            { label: client.companyName },
          ]}
        />
      }
    >
      <ClientProfile client={client} notes={notes} tab={clientProfileTab(query.tab)} editing={query.edit === "1"} />
    </Workspace>
  );
}
