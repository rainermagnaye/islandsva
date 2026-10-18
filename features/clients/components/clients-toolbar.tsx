"use client";

import { useRouter } from "next/navigation";
import { FilterMenu } from "@/components/ui/filter-menu";
import { appRoutes } from "@/content/routes";
import { CLIENT_STATUS_LABELS, type ClientStatus } from "../contract";

type ClientFilter = ClientStatus | "disabled";

const STATUS_OPTIONS: { value: ClientFilter; label: string }[] = [
  ...(Object.keys(CLIENT_STATUS_LABELS) as ClientStatus[]).map((value) => ({ value, label: CLIENT_STATUS_LABELS[value] })),
  { value: "disabled", label: "Disabled" },
];

/** Status filter, the same ghost button as the team and lead lists. Disabled lists every hidden client. */
export function ClientsToolbar({ status, disabled, query }: { status?: ClientStatus; disabled?: boolean; query?: string }) {
  const router = useRouter();
  const value: ClientFilter | undefined = disabled ? "disabled" : status;

  function filterBy(next: ClientFilter | undefined) {
    const params = new URLSearchParams();
    if (next === "disabled") params.set("disabled", "1");
    else if (next) params.set("status", next);
    if (query) params.set("q", query);
    const search = params.toString();
    router.push(search ? `${appRoutes.adminClients}?${search}` : appRoutes.adminClients);
  }

  return <FilterMenu options={STATUS_OPTIONS} value={value} onChange={filterBy} allLabel="All Clients" />;
}
