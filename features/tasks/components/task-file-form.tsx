"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { CLIENT_ATTACHMENT_ACCEPT } from "@/features/clients/attachment";
import { addTaskFiles } from "../actions";

/** Drop zone and submit, loaded when the client chooses to add files. */
export function TaskFileForm({ taskId, room }: { taskId: string; room: number }) {
  const [chosen, setChosen] = useState<string[]>([]);

  return (
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
  );
}
