"use client";

import { useRouter } from "next/navigation";
import { FilterMenu } from "@/components/ui/filter-menu";
import { appRoutes } from "@/content/routes";
import { TASK_FILTER_OPTIONS, type TaskFilter } from "./task-filter";

/** The shared Filter menu for the VA's task list. Writes `?show=` and keeps the current search. */
export function TasksFilter({ value, query }: { value: TaskFilter | undefined; query: string }) {
  const router = useRouter();

  function filterBy(next: TaskFilter | undefined) {
    const params = new URLSearchParams();
    if (next) params.set("show", next);
    if (query) params.set("q", query);
    const search = params.toString();
    router.push(search ? `${appRoutes.vaTasks}?${search}` : appRoutes.vaTasks);
  }

  return <FilterMenu options={TASK_FILTER_OPTIONS} value={value} onChange={filterBy} allLabel="All Tasks" />;
}
