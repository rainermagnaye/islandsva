import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/layout/workspace";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { appRoutes, closerClientHref } from "@/content/routes";
import { ClientsTable } from "@/features/clients/components/clients-table";
import { listClients } from "@/features/clients/dal";
import { DiscoveryInbox } from "@/features/meetings/components/discovery-inbox";
import { listDiscoveryInbox } from "@/features/meetings/dal";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Closer workspace" };

export default function CloserHomePage({ searchParams }: PageProps<"/closer">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <CloserHome searchParams={searchParams} />
    </Suspense>
  );
}

const pageHref = (page: number) => (page > 1 ? `${appRoutes.closer}?page=${page}` : appRoutes.closer);

async function CloserHome({ searchParams }: Pick<PageProps<"/closer">, "searchParams">) {
  await requireRole(["closer"]);
  const query = await searchParams;
  const requested = Number(Array.isArray(query.page) ? query.page[0] : query.page);
  // RLS limits the list to the clients this Closer created.
  const [{ clients, total, page, pageCount }, requests] = await Promise.all([
    listClients({ page: Number.isInteger(requested) && requested > 0 ? requested : 1 }),
    listDiscoveryInbox(),
  ]);

  return (
    <Container className="grid gap-7 py-10 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="m-0 type-h1">Your clients</h1>
          <p className="m-0 text-ink-muted">Add a client, send their onboarding form, and activate them once they&apos;ve paid.</p>
        </div>
        <Button href={appRoutes.closerNewClient} iconLeft="plus">
          New client
        </Button>
      </div>
      <DiscoveryInbox requests={requests} />
      <div className="grid gap-4">
        <ClientsTable
          keepHeader
          clients={clients}
          hrefFor={closerClientHref}
          empty={<EmptyState compact title="No clients yet" description="Add the first client you've agreed a package with." />}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 type-body-sm text-ink-muted">{total === 1 ? "1 client" : `${total} clients`}</p>
          <Pagination label="Client pages" page={page} totalPages={pageCount} hrefFor={pageHref} />
        </div>
      </div>
    </Container>
  );
}
