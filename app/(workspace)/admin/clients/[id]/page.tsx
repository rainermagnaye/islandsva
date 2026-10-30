import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { appRoutes } from "@/content/routes";
import { clientProfileTab } from "@/features/clients/contract";
import { agreementApprovable } from "@/features/clients/agreement";
import { AgreementEvidence, PaymentChecklist } from "@/features/clients/components/agreement-evidence";
import { ClientProfile } from "@/features/clients/components/client-profile";
import { onboardingUrl, registrationOrigin } from "@/features/clients/link";
import { getClient } from "@/features/clients/dal";
import { listClientNotes } from "@/features/clients/notes-dal";
import { listActiveAssignments } from "@/features/clients/assignment-dal";
import { listShortlist } from "@/features/matching/dal";
import { getClientPacket } from "@/features/clients/onboarding-dal";
import { agreementReviewFor } from "@/features/clients/service";
import { listAssignableVas } from "@/features/users/service";
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
  // Independent reads, in parallel; each runs as the signed-in admin, so RLS applies too.
  const [client, notes, assignments, offers, vas] = await Promise.all([getClient(id), listClientNotes(id), listActiveAssignments(id), listShortlist(id), listAssignableVas()]);
  if (!client) notFound();
  // The packet and agreement tables are server-only. Read them only after this admin can see the client;
  // agreementReviewFor checks the admin role again itself.
  const [stored, agreement] = await Promise.all([getClientPacket(id), agreementReviewFor(id)]);
  const review = {
    evidence: <AgreementEvidence review={agreement} forApproval />,
    record: <AgreementEvidence review={agreement} forApproval={false} />,
    checklist: <PaymentChecklist />,
    approvable: agreementApprovable(agreement?.state),
  };
  const packet = {
    url: stored?.token ? onboardingUrl(stored.token, await registrationOrigin()) : null,
    consentName: stored?.consentName ?? null,
    consentSignedAt: stored?.consentSignedAt ?? null,
    paymentProofName: stored?.paymentProofName ?? null,
    paymentProofType: stored?.paymentProofType ?? null,
    reviewIssues: stored?.reviewIssues ?? [],
    reviewNote: stored?.reviewNote ?? null,
  };

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
      <ClientProfile client={client} notes={notes} packet={packet} review={review} assignments={assignments} offers={offers} vas={vas} tab={clientProfileTab(query.tab)} editing={query.edit === "1"} />
    </Workspace>
  );
}
