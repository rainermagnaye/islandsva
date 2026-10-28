"use client";

import { useState } from "react";
import { AttachmentPreview } from "@/components/ui/attachment-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { CLIENT_ATTACHMENT_ACCEPT } from "@/features/clients/attachment";
import { addTaskFiles } from "../actions";
import { TASK_LIMITS } from "../contract";

export type TaskFileView = { id: string; name: string; type: string; href: string };

/** The task's files. The client can add more while the task is open, up to the limit; the drop zone is the file input. */
export function TaskFiles({ taskId, files, canAdd }: { taskId: string; files: readonly TaskFileView[]; canAdd: boolean }) {
  const [chosen, setChosen] = useState<string[]>([]);
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
        <Form<string>
          aria-label="Add files"
          onSubmit={async (formData) => {
            const result = await addTaskFiles(formData);
            if (result.ok) setChosen([]);
            return result;
          }}
          className="gap-3"
        >
          {({ pending }) => (
            <>
              <input type="hidden" name="taskId" value={taskId} />
              <label className="relative grid cursor-pointer justify-items-center gap-1.5 rounded-md border-control border-dashed border-border-strong p-6 text-center type-body-sm text-ink-muted focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring hover:bg-surface-sunken">
                <Icon name="file" />
                <span>
                  <strong className="text-ink">Drop {room === 1 ? "a file" : "files"} here</strong> or choose {room === 1 ? "one" : "up to " + room}
                </span>
                <span className="type-caption">PDF, image or audio, up to 2 MB in total</span>
                {/* Covers the zone, so a dropped file lands in the input itself. */}
                <input
                  type="file"
                  name="attachment"
                  multiple={room > 1}
                  accept={CLIENT_ATTACHMENT_ACCEPT}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(event) => setChosen(Array.from(event.target.files ?? []).map((file) => file.name))}
                />
              </label>
              {chosen.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="m-0 min-w-0 truncate type-body-sm">{chosen.join(", ")}</p>
                  <Button type="submit" variant="secondary" size="sm" iconLeft="plus" loading={pending}>
                    {pending ? "Adding" : chosen.length === 1 ? "Add file" : "Add files"}
                  </Button>
                </div>
              )}
            </>
          )}
        </Form>
      )}
    </Card>
  );
}
