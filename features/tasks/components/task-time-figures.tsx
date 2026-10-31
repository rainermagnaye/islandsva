"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatMs } from "../time";

const TICK_MS = 1_000;

const pad = (value: number) => String(value).padStart(2, "0");
/** "00:24:10" */
const stopwatch = (ms: number) => {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
};

/**
 * Duration, time used and time left. While the VA's timer runs, the numbers move on their own: the server sends
 * the closed sessions' total and the running start, and this counts from there. The first paint uses the
 * server's clock, so it matches the HTML; the next tick (every second, only while running) moves to the browser's.
 * A running session also shows its own stopwatch.
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

  const session = runningSince ? Math.max(0, now - Date.parse(runningSince)) : null;

  return (
    <div className="grid gap-4">
      {session !== null && (
        <p className="m-0 grid gap-1">
          <span className="type-label text-ink-muted">This session</span>
          <span role="timer" aria-live="off" className="type-display-lg tabular-nums text-ink">
            {stopwatch(session)}
          </span>
        </p>
      )}
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
    </div>
  );
}
