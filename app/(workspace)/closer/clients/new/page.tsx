import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { appRoutes } from "@/content/routes";
import { NewClientForm } from "@/features/clients/components/new-client-form";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New client" };

export default function NewClientPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <NewClient />
    </Suspense>
  );
}

async function NewClient() {
  await requireRole(["closer"]);
  return (
    <Workspace
      title="New client"
      lead="Add the client and the package you've agreed. They stay pending until they've sent the onboarding form and paid."
      breadcrumbs={<Breadcrumbs items={[{ label: "Your clients", href: appRoutes.closer }, { label: "New client" }]} />}
    >
      <div className="max-w-2xl">
        <NewClientForm />
      </div>
    </Workspace>
  );
}
