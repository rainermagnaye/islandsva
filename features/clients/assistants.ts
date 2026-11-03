import type { TaskStatus } from "@/features/tasks/contract";

export type AssistantStatus = "active" | "offered";

export type ClientAssistantRow = {
  vaId: string;
  assignmentId: string | null;
  name: string;
  status: AssistantStatus;
  closedTasks: number;
  totalTasks: number;
  hoursPerWeek: number | null;
  href: string | null;
};

/** Closed / total tasks per VA. */
export function assistantTaskCounts(tasks: readonly { vaId: string; status: TaskStatus }[]) {
  const counts = new Map<string, { closed: number; total: number }>();
  for (const task of tasks) {
    const row = counts.get(task.vaId) ?? { closed: 0, total: 0 };
    row.total += 1;
    if (task.status === "done") row.closed += 1;
    counts.set(task.vaId, row);
  }
  return counts;
}

/** Assigned VAs first, then open offers, for this client's Assistants table. */
export function clientAssistantRows(input: {
  assignments: readonly { id: string; vaId: string; vaName: string }[];
  offers: readonly { vaId: string; vaFirstName: string; status: string }[];
  tasks: readonly { vaId: string; status: TaskStatus }[];
  hoursPerWeek: number | null;
  hrefFor: (vaId: string) => string;
}): ClientAssistantRow[] {
  const counts = assistantTaskCounts(input.tasks);
  const assigned = new Set(input.assignments.map((row) => row.vaId));
  const assignedRows = input.assignments.map((row) => {
    const tasks = counts.get(row.vaId) ?? { closed: 0, total: 0 };
    return {
      vaId: row.vaId,
      assignmentId: row.id,
      name: row.vaName,
      status: "active" as const,
      closedTasks: tasks.closed,
      totalTasks: tasks.total,
      hoursPerWeek: input.hoursPerWeek,
      href: input.hrefFor(row.vaId),
    };
  });
  const offeredRows = input.offers
    .filter((offer) => offer.status === "offered" && !assigned.has(offer.vaId))
    .map((offer) => {
      const tasks = counts.get(offer.vaId) ?? { closed: 0, total: 0 };
      return {
        vaId: offer.vaId,
        assignmentId: null,
        name: offer.vaFirstName,
        status: "offered" as const,
        closedTasks: tasks.closed,
        totalTasks: tasks.total,
        hoursPerWeek: input.hoursPerWeek,
        href: null,
      };
    });
  return [...assignedRows, ...offeredRows];
}

export function packageBalanceLabel(hoursPerWeek: number | null) {
  return hoursPerWeek ? `${hoursPerWeek} h / week` : "Not set";
}
