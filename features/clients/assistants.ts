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

/**
 * VAs a package includes: Day and night runs two shifts, every other package one VA. The database applies the
 * same rule in assign_client_va and record_client_invite (20261109111500_admin_va_assignment); change both together.
 */
export function vasForPackage(packageCode: string | null) {
  return packageCode === "day-and-night" ? 2 : 1;
}

/** How many more VAs the admin still assigns before the package is staffed. */
export function vaSlotsLeft(packageCode: string | null, activeCount: number) {
  return Math.max(0, vasForPackage(packageCode) - activeCount);
}

/**
 * Whether an admin may assign a VA now: once the payment is approved (before or after the activation email) or
 * while the client is active, never while disabled or without a package. Mirrors assign_client_va.
 */
export function canAssignVa(client: { status: string; onboardingStatus: string | null; disabledAt: string | null; packageCode: string | null }) {
  if (client.disabledAt || !client.packageCode) return false;
  if (client.status === "active") return true;
  return client.status === "pending" && (client.onboardingStatus === "approved" || client.onboardingStatus === "invite_sent");
}
