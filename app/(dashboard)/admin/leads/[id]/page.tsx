import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Panel } from "@/components/ui/card";
import { appRoutes } from "@/content/routes";
import { isConvertible, nextStatuses } from "@/features/leads/contract";
import { ConvertLeadButton } from "@/features/leads/components/convert-lead-button";
import { LeadStatusActions } from "@/features/leads/components/lead-status-actions";
import { LeadStatusBadge, packageName } from "@/features/leads/components/lead-status";
import { getLead } from "@/features/leads/dal";
import { requireRole } from "@/lib/auth/session";

// Static title: the lead's name is personal data and stays out of the tab title and browser history.
export const metadata: Metadata = { title: "Lead" };

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default function AdminLeadPage({ params }: PageProps<"/admin/leads/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminLead params={params} />
    </Suspense>
  );
}

async function AdminLead({ params }: Pick<PageProps<"/admin/leads/[id]">, "params">) {
  await requireRole(["admin"]);
  const lead = await getLead((await params).id);
  if (!lead) notFound();

  const options = nextStatuses(lead.status);

  return (
    <Workspace
      title={lead.fullName}
      lead={lead.companyName ?? undefined}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Admin", href: appRoutes.admin },
            { label: "Leads", href: appRoutes.adminLeads },
            { label: lead.fullName },
          ]}
        />
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <Panel boxed title="Discovery call">
          <dl className="m-0 grid gap-3 type-body-sm">
            <Detail term="Company">{lead.companyName ?? "—"}</Detail>
            <Detail term="Industry">{lead.industry ?? "—"}</Detail>
            <Detail term="Country">{lead.country ?? "—"}</Detail>
            <Detail term="Package">{packageName(lead.packageCode)}</Detail>
            <Detail term="How can we help?">
              <span className="whitespace-pre-wrap break-words">{lead.message}</span>
            </Detail>
          </dl>
        </Panel>

        <div className="grid gap-6">
          <Panel boxed title="Details">
            <dl className="m-0 grid gap-3 type-body-sm">
              <Detail term="Status">
                <LeadStatusBadge status={lead.status} />
              </Detail>
              <Detail term="Email">
                <a href={`mailto:${lead.email}`} className="break-all">
                  {lead.email}
                </a>
              </Detail>
              <Detail term="Assigned closer">{lead.closerName ?? "—"}</Detail>
              <Detail term="Received">{when.format(new Date(lead.createdAt))} UTC</Detail>
              {lead.updatedAt !== lead.createdAt && <Detail term="Last updated">{when.format(new Date(lead.updatedAt))} UTC</Detail>}
            </dl>
          </Panel>

          <Panel boxed title="Next step">
            {isConvertible(lead.status) && (
              <div className="grid justify-items-start gap-2">
                <p className="m-0 type-body-sm text-ink-muted">Ready to work with them? Create their client record.</p>
                <ConvertLeadButton lead={{ id: lead.id, fullName: lead.fullName, companyName: lead.companyName }} />
              </div>
            )}
            {options.length > 0 ? (
              <LeadStatusActions leadId={lead.id} options={options} />
            ) : (
              <p className="m-0 type-body-sm text-ink-muted">
                This lead is now a client. Find them under{" "}
                <Link href={appRoutes.adminClients}>Clients</Link>.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </Workspace>
  );
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-ink-muted">{term}</dt>
      <dd className="m-0 text-ink">{children}</dd>
    </div>
  );
}
