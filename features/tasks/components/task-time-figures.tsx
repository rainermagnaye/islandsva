"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatMs } from "../time";

const TICK_MS = 15_000;

/**
 * Duration, time used and time left. While the VA's timer runs, the numbers move on their own: the server sends
 * the closed sessions' total and the running start, and this counts from there. The first paint uses the
 * server's clock, so it matches the HTML; the next tick (every 15 seconds) moves to the browser's.
 */
export function TaskTimeFigures({ durationMinutes, closedMs, runningSince, serverNow }: { durationMinutes: number; closedMs: number; runningSince: string | null; serverNow: string }) {
  const [now, setNow] = useState(() => Date.parse(serverNow));
  useEffect(() => {
    if (!runningSince) return;
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [runningSince]);

  const used = closedMs + (runningSince ? Math.max(0, now - Date.parse(runningSince)) : 0);
  const left = durationMinutes * 60_000 - used;
  const over = left < 0;

  return (
    <dl className="m-0 grid gap-4 sm:grid-cols-3">
      <div className="grid gap-1">
        <dt className="type-label text-ink-muted">Duration</dt>
        <dd className="m-0 type-h4 tabular-nums">{formatMs(durationMinutes * 60_000)}</dd>
      </div>
      <div className="grid gap-1">
        <dt className="type-label text-ink-muted">Time used</dt>
        <dd className="m-0 type-h4 tabular-nums">{formatMs(used)}</dd>
      </div>
      <div className="grid gap-1">
        <dt className="type-label text-ink-muted">{over ? "Over by" : "Time left"}</dt>
        <dd className="m-0 flex flex-wrap items-center gap-2 type-h4 tabular-nums">
          {formatMs(left)}
          {over && (
            <Badge tone="warning" size="sm">
              Delayed
            </Badge>
          )}
        </dd>
      </div>
    </dl>
  );
}
