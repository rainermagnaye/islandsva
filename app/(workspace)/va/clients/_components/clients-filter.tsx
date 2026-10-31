"use client";

import { useRouter } from "next/navigation";
import { FilterMenu } from "@/components/ui/filter-menu";
import { appRoutes } from "@/content/routes";
import type { ClientView } from "./client-rows";

const OPTIONS: { value: Exclude<ClientView, "all">; label: string }[] = [
  { value: "attention", label: "Needs attention" },
  { value: "daytime", label: "Daytime for them" },
];

/** The shared Filter menu for the VA's client list. Writes `?view=` and keeps the current search. */
export function ClientsFilter({ view, query }: { view: ClientView; query: string }) {
  const router = useRouter();

  function filterBy(next: Exclude<ClientView, "all"> | undefined) {
    const params = new URLSearchParams();
    if (next) params.set("view", next);
    if (query) params.set("q", query);
    const search = params.toString();
    router.push(search ? `${appRoutes.vaClients}?${search}` : appRoutes.vaClients);
  }

  return <FilterMenu options={OPTIONS} value={view === "all" ? undefined : view} onChange={filterBy} allLabel="All Clients" />;
}
