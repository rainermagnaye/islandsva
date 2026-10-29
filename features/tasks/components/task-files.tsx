"use client";

import { lazy, Suspense, useState } from "react";
import { AttachmentPreview } from "@/components/ui/attachment-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TASK_LIMITS } from "../contract";

export type TaskFileView = { id: string; name: string; type: string; href: string };

const TaskFileForm = lazy(() => import("./task-file-form").then((m) => ({ default: m.TaskFileForm })));

/** The task's files. The drop zone loads when adding, so the task page doesn't ship the form on first load. */
export function TaskFiles({ taskId, files, canAdd }: { taskId: string; files: readonly TaskFileView[]; canAdd: boolean }) {
  const [adding, setAdding] = useState(false);
  const room = TASK_LIMITS.attachments - files.length;

  return (
    <Card as="section" aria-labelledby="task-files" className="grid gap-4">
      <h2 id="task-files" className="m-0 type-h4">
        Attachments{" "}
        <span className="font-medium text-ink-muted">
          · {files.length} of {TASK_LIMITS.attachments}
        </span>
      </h2>
      {files.length > 0 && (
        <ul className="m-0 grid list-none gap-2 p-0">
          {files.map((file) => (
            <li key={file.id}>
              <AttachmentPreview href={file.href} name={file.name} type={file.type} />
            </li>
          ))}
        </ul>
      )}
      {files.length === 0 && !canAdd && <p className="m-0 type-body-sm text-ink-muted">No attachments.</p>}
      {canAdd && room > 0 && (
        adding ? (
          <Suspense fallback={null}>
            <TaskFileForm taskId={taskId} room={room} />
          </Suspense>
        ) : (
          <Button type="button" variant="secondary" size="sm" iconLeft="plus" onClick={() => setAdding(true)}>
            Add files
          </Button>
        )
      )}
    </Card>
  );
}
