import type { ShortlistEntry } from "./contract";

// Where each offered VA is in the match flow: view → demo → add or decline. Pure, so it is tested without a database.

/** One of the client's demo bookings, as the match page needs it. */
export type DemoForMatch = {
  id: string;
  vaId: string;
  /** The status as it is now (see demoState in features/demos/contract.ts): a past request is expired, a past call completed. */
  state: "pending" | "confirmed" | "rejected" | "cancelled" | "completed" | "expired";
  startsAt: string;
  rejectReason: string | null;
};

export type MatchStage =
  | { kind: "new"; last: DemoForMatch | null }
  | { kind: "requested"; demo: DemoForMatch }
  | { kind: "confirmed"; demo: DemoForMatch }
  | { kind: "met"; demo: DemoForMatch };

/**
 * An offer's stage from the client's demos with that VA. A call that happened ("met") stays met even if a later
 * request was cancelled; otherwise the latest booking decides. A refused, expired or cancelled request is "new"
 * again, with that booking kept so the page can say what happened.
 */
export function matchStage(offer: Pick<ShortlistEntry, "vaId">, demos: readonly DemoForMatch[]): MatchStage {
  const theirs = demos.filter((demo) => demo.vaId === offer.vaId).sort((a, b) => (a.startsAt < b.startsAt ? 1 : a.startsAt > b.startsAt ? -1 : 0));
  const open = theirs.find((demo) => demo.state === "pending" || demo.state === "confirmed");
  if (open) return open.state === "pending" ? { kind: "requested", demo: open } : { kind: "confirmed", demo: open };
  const met = theirs.find((demo) => demo.state === "completed");
  if (met) return { kind: "met", demo: met };
  return { kind: "new", last: theirs[0] ?? null };
}

/** The client's one open demo, if any: the database allows one at a time across every VA. */
export function openDemo(demos: readonly DemoForMatch[]): DemoForMatch | null {
  return demos.find((demo) => demo.state === "pending" || demo.state === "confirmed") ?? null;
}
