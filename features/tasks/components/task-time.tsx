import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { TaskStatus, WorkSession } from "../contract";
import { formatMs, runningSession } from "../time";
import { cx } from "@/lib/cx";
import { CompleteButton, MoveButton, TimerButton } from "./task-moves";
import { TaskTimeFigures } from "./task-time-figures";

/**
 * The task's time: its duration against the VA's work sessions, with each session listed. Times read in the
 * viewer's zone. The VA's controls sit here, by state: Start (to do), Pause and Complete (running), Resume and
 * Complete (paused, or sent back by the client). One primary button at a time.
 */
export function TaskTime({
  taskId,
  companyName,
  canResume,
  durationMinutes,
  sessions,
  status,
  vaName,
  viewer,
  timeZone,
  now,
}: {
  durationMinutes: number;
  sessions: readonly WorkSession[];
  status: TaskStatus;
  vaName: string;
  viewer: "client" | "va";
  timeZone: string;
  now: Date;
  taskId: string;
  companyName: string;
  /** The VA is still on the assignment. Pause needs no such check, so a clock never runs on. */
  canResume: boolean;
}) {
  const running = runningSession(sessions);
  const closedMs = sessions.reduce((sum, session) => (session.endedAt === null ? sum : sum + Math.max(0, Date.parse(session.endedAt) - Date.parse(session.startedAt))), 0);
  const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone });
  const who = viewer === "client" ? vaName : "You";
  // Pause needs no assignment check, so a running clock can always be stopped.
  const controls =
    viewer !== "va" ? null : running ? (
      <>
        <TimerButton taskId={taskId} timer="pause" />
        {canResume && <CompleteButton taskId={taskId} companyName={companyName} />}
      </>
    ) : !canResume ? null : status === "todo" ? (
      <MoveButton taskId={taskId} status="in_progress" label="Start task" pendingLabel="Starting" variant="primary" icon="clock" />
    ) : status === "in_progress" ? (
      <>
        <TimerButton taskId={taskId} timer="start" />
        <CompleteButton taskId={taskId} companyName={companyName} variant="ghost" />
      </>
    ) : null;

  const state = running
    ? { label: "Timer running", tone: "info" as const, line: `${who} started this session at ${clock.format(new Date(running.startedAt))}.` }
    : sessions.length === 0
      ? { label: "Not started", tone: "neutral" as const, line: status === "todo" ? `The timer starts when ${who === "You" ? "you start" : `${vaName} starts`} the task.` : "No time recorded on this task." }
      : status === "in_progress"
        ? { label: "Paused", tone: "neutral" as const, line: `The remaining time carries on when ${who === "You" ? "you resume" : `${vaName} resumes`}.` }
        : { label: "Stopped", tone: "neutral" as const, line: status === "review" ? "The timer stopped when the task went to review." : "The timer stopped when the task was closed." };

  return (
    <Card as="section" aria-labelledby="task-time" className={cx("grid gap-4", running && "border-2 border-action-secondary")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="task-time" className="m-0 type-h4">
          Time
        </h2>
        <Badge tone={state.tone} size="sm" dot>
          {state.label}
        </Badge>
      </div>
      <TaskTimeFigures durationMinutes={durationMinutes} closedMs={closedMs} runningSince={running?.startedAt ?? null} serverNow={now.toISOString()} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 type-body-sm text-ink-muted">{state.line}</p>
        {controls && <div className="flex flex-wrap items-center gap-3">{controls}</div>}
      </div>
      {sessions.length > 0 && (
        <div className="grid gap-2 border-t border-border pt-4">
          <h3 id="task-sessions" className="m-0 type-label text-ink-muted">
            Sessions
          </h3>
          <ol aria-labelledby="task-sessions" className="m-0 grid list-none gap-1 p-0">
            {sessions.map((session, index) => {
              const start = new Date(session.startedAt);
              const end = session.endedAt ? new Date(session.endedAt) : null;
              const length = (end ?? now).getTime() - start.getTime();
              return (
                <li key={session.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md bg-surface-sunken px-3 py-2 type-body-sm">
                  <span>
                    <strong>Session {index + 1}</strong>
                    <span className="text-ink-muted">
                      {" "}
                      · {day.format(start)}, {clock.format(start)}–{end ? clock.format(end) : "now"}
                    </span>
                  </span>
                  <span className="tabular-nums">{end ? formatMs(length) : `${formatMs(length)} so far`}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Card>
  );
}
