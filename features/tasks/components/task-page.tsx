import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { clockLabel, formatDate, minutesOf } from "@/components/ui/date-math";
import { ACTIVITY_LABELS, lastAt, openFeedback, progressStep, taskActivity } from "../activity";
import { TASK_SEVERITY_LABELS, type Task, type TaskComment, type TaskEvent, type WorkSession } from "../contract";
import { isOverdue, relativeDay } from "../metrics";
import { formatMinutes } from "../time";
import { TaskComments } from "./task-comments";
import { TaskDetails, type ActivityView } from "./task-details";
import { TaskFiles, type TaskFileView } from "./task-files";
import { TaskHeader, type TaskNotice } from "./task-header";
import { TaskTime } from "./task-time";

type Viewer = "client" | "va";

/**
 * One task, for the client who owns it or the VA doing it: the header card with progress and the next move,
 * then description, files and comments beside the details and activity. Pages pass what the viewer may do;
 * the database checks every write again.
 */
export function TaskPage({
  viewer,
  viewerId,
  task,
  events,
  sessions,
  comments,
  files,
  timeZone,
  crumbs,
  vaHref,
  canMove,
  canComment,
  canAddFiles,
  edit,
  now = new Date(),
}: {
  viewer: Viewer;
  viewerId: string;
  task: Task;
  events: readonly TaskEvent[];
  /** The VA's work sessions on this task, oldest first. */
  sessions: readonly WorkSession[];
  comments: readonly TaskComment[];
  files: readonly TaskFileView[];
  /** The zone the viewer reads times in: the client's company zone, or Philippine time for a VA. */
  timeZone: string;
  crumbs: readonly Crumb[];
  vaHref?: string;
  canMove: boolean;
  canComment: boolean;
  canAddFiles: boolean;
  edit: { today: string; last: string; timeZone: string } | null;
  now?: Date;
}) {
  const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone });
  const at = (iso: string) => when.format(new Date(iso));
  const va = task.vaFirstName;
  const company = task.companyName;
  const deadlineDay = formatDate(task.deadline, { dateStyle: "medium" });
  const deadline = task.deadlineTime ? `${deadlineDay}, ${clockLabel(minutesOf(task.deadlineTime))}` : deadlineDay;
  const submitted = lastAt(events, ["submitted"]);
  const closing = [...events].reverse().find((event) => event.kind === "approved" || event.kind === "closed");
  const approved = closing?.kind === "approved";

  const steps = [
    { label: "To do", description: day.format(new Date(task.createdAt)) },
    { label: "In progress", description: task.startedAt ? day.format(new Date(task.startedAt)) : "Not started" },
    {
      label: "Review",
      description:
        task.status === "review"
          ? viewer === "client"
            ? "Your approval"
            : `With ${company}`
          : task.status === "done"
            ? submitted
              ? day.format(new Date(submitted))
              : "Skipped"
            : `Due ${formatDate(task.deadline, { month: "short", day: "numeric" })}`,
    },
    { label: "Closed", description: task.status === "done" && task.doneAt ? day.format(new Date(task.doneAt)) : "After approval" },
  ];

  const feedback = openFeedback(task.status, events);
  const notice: TaskNotice | null =
    task.status === "review"
      ? viewer === "client"
        ? { tone: "info", title: `${va} finished this task and it's waiting for your review`, body: `Approve it to close the task, or request changes and ${va} will pick it up again.` }
        : { tone: "info", title: "Submitted for review", body: `${company} will approve it or ask for changes.` }
      : task.status === "done"
        ? viewer === "client"
          ? { tone: "success", title: "Task closed", body: `${approved ? "You approved this task." : "This task is closed."} Reopen it if something still needs work.` }
          : { tone: "success", title: "Task closed", body: `${company} ${approved ? "approved" : "closed"} this task.` }
        : feedback && viewer === "va"
          ? { tone: "warning", title: feedback.kind === "reopened" ? `${company} reopened this task` : `${company} asked for changes`, body: "Make the changes, then submit it for review again.", quote: feedback.note }
          : null;

  const waiting =
    viewer === "client"
      ? task.status === "todo"
        ? `Waiting for ${va} to start`
        : task.status === "in_progress"
          ? `${va} is working on this`
          : null
      : !canMove && task.status !== "done"
        ? "This assignment has ended"
        : task.status === "review"
          ? `Waiting for ${company} to review`
          : null;

  const name = (id: string | null, firstName: string | null) => (id !== null && id === viewerId ? "You" : firstName);
  const activity: ActivityView[] = taskActivity(task, events).map((entry) => ({
    key: entry.key,
    kind: entry.kind,
    title: ACTIVITY_LABELS[entry.kind],
    who: entry.kind === "added" ? (entry.actor?.id === viewerId ? "You" : company) : entry.actor === null ? null : entry.actor.id === null ? "Islands VA" : name(entry.actor.id, entry.actor.firstName),
    when: at(entry.at),
    note: entry.note,
  }));

  const due = (
    <>
      <span className="inline-flex flex-wrap items-center gap-2">
        {deadline}
        {isOverdue(task, now) && (
          <Badge tone="danger" size="sm">
            Overdue
          </Badge>
        )}
      </span>
      <br />
      <span className="type-body-sm text-ink-muted">
        {relativeDay(task.deadline, task.deadlineTimezone, now)} · {viewer === "client" ? "your time" : `${company} time`}
      </span>
    </>
  );
  const vaFact = (
    <span className="flex items-center gap-2.5">
      <Avatar name={va} size="sm" />
      {viewer === "client" && vaHref ? <Link href={vaHref}>{va}</Link> : viewer === "va" ? "You" : va}
    </span>
  );
  const facts =
    viewer === "client"
      ? [
          { label: "Assigned VA", value: vaFact },
          { label: "Due", value: due },
          { label: "Priority", value: TASK_SEVERITY_LABELS[task.severity] },
          { label: "Duration", value: formatMinutes(task.durationMinutes) },
          { label: "Company", value: company },
        ]
      : [
          { label: "Company", value: company },
          { label: "Due", value: due },
          { label: "Priority", value: TASK_SEVERITY_LABELS[task.severity] },
          { label: "Duration", value: formatMinutes(task.durationMinutes) },
          { label: "Assigned VA", value: vaFact },
        ];

  const meta = viewer === "client" ? `For ${va} · ${company} · Added ${at(task.createdAt)}` : `From ${company} · Added ${at(task.createdAt)}`;

  return (
    <div className="grid gap-6">
      <Breadcrumbs items={crumbs} />
      <TaskHeader task={task} viewer={viewer} meta={meta} steps={steps} step={progressStep(task.status)} notice={notice} canMove={canMove} waiting={waiting} edit={edit} />
      <div className="flex flex-wrap items-start gap-6">
        <div className="grid min-w-0 flex-[999_1_32rem] gap-6">
          <TaskTime taskId={task.id} companyName={company} canResume={canMove} durationMinutes={task.durationMinutes} sessions={sessions} status={task.status} vaName={va} viewer={viewer} timeZone={timeZone} now={now} />
          <Card as="section" aria-labelledby="task-description" className="grid gap-3">
            <h2 id="task-description" className="m-0 type-h4">
              Description
            </h2>
            <p className="m-0 whitespace-pre-wrap break-words type-body">{task.description?.trim() || "No description."}</p>
          </Card>
          <TaskFiles taskId={task.id} files={files} canAdd={canAddFiles} />
          <TaskComments
            taskId={task.id}
            comments={comments}
            canComment={canComment}
            viewerId={viewerId}
            timeZone={timeZone}
            empty={viewer === "client" ? `No comments yet. Ask ${va} a question or add context below.` : `No comments yet. Ask ${company} a question below.`}
          />
        </div>
        <div className="min-w-0 flex-[1_1_18rem]">
          <TaskDetails facts={facts} activity={activity} />
        </div>
      </div>
    </div>
  );
}
