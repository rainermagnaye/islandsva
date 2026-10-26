// Package mix for the admin overview. The caller passes only active, enabled clients. This only groups them.

export type PackageClient = { packageCode: string | null; monthlyCents: number | null };

export type PackageSlice = { code: string | null; label: string; count: number; monthlyCents: number };

/** Counts and monthly totals by package. A missing price counts as zero. An unknown code keeps its own label. */
export function packageMix(clients: readonly PackageClient[], names: Readonly<Record<string, string>>): PackageSlice[] {
  const groups = new Map<string, PackageSlice>();
  for (const client of clients) {
    const code = client.packageCode;
    const key = code ?? "";
    const slice = groups.get(key) ?? {
      code,
      label: code === null ? "No package" : (names[code] ?? code),
      count: 0,
      monthlyCents: 0,
    };
    slice.count += 1;
    slice.monthlyCents += client.monthlyCents ?? 0;
    groups.set(key, slice);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.code === null) return 1;
    if (b.code === null) return -1;
    return a.label.localeCompare(b.label);
  });
}
