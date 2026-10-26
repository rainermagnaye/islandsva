// VA load for the admin overview. Hours are the client's full week, so two VAs on one client each show that week.
// On-time stays null when that VA has no completed tasks — the screen shows an em dash, never 0%.

export type LoadVa = { id: string; firstName: string };

export type LoadAssignment = { vaId: string; clientId: string; hoursPerWeek: number | null };

export type LoadFigures = { vaId: string; done: number; onTimeRate: number | null; overdue: number };

export type VaLoadRow = {
  vaId: string;
  firstName: string;
  clients: number;
  hoursPerWeek: number;
  done: number;
  onTimeRate: number | null;
  overdue: number;
};

const emptyFigures = { done: 0, onTimeRate: null, overdue: 0 };

/** One row per VA, sorted by first name. A pair listed twice counts once. A VA with no assignment stays at zero. */
export function vaLoad(vas: readonly LoadVa[], assignments: readonly LoadAssignment[], figures: readonly LoadFigures[] = []): VaLoadRow[] {
  const byVa = new Map(figures.map((row) => [row.vaId, row]));
  const seen = new Set<string>();
  const totals = new Map<string, { clients: number; hoursPerWeek: number }>();

  for (const assignment of assignments) {
    const pair = `${assignment.vaId}:${assignment.clientId}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    const total = totals.get(assignment.vaId) ?? { clients: 0, hoursPerWeek: 0 };
    total.clients += 1;
    total.hoursPerWeek += assignment.hoursPerWeek ?? 0;
    totals.set(assignment.vaId, total);
  }

  return vas
    .map((va) => {
      const load = totals.get(va.id) ?? { clients: 0, hoursPerWeek: 0 };
      const task = byVa.get(va.id) ?? emptyFigures;
      return {
        vaId: va.id,
        firstName: va.firstName,
        clients: load.clients,
        hoursPerWeek: load.hoursPerWeek,
        done: task.done,
        onTimeRate: task.onTimeRate,
        overdue: task.overdue,
      };
    })
    .sort((a, b) => a.firstName.localeCompare(b.firstName) || (a.vaId < b.vaId ? -1 : 1));
}
