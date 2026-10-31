"use client";

import { Button } from "@/components/ui/button";
import { clockLabel, formatDate, minutesOf } from "@/components/ui/date-math";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { removeBlockAction } from "@/features/tasks/actions";
import type { ScheduleEvent } from "@/components/ui/schedule-events";

/** Confirm removal of a VA to-do block. Loaded when the VA clicks one, so Form stays off the calendar's first load. */
export function RemoveBlockDialog({
  blockId,
  block,
  onClose,
}: {
  blockId: string;
  block: ScheduleEvent;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={block.title}
      description={`${formatDate(block.start.slice(0, 10), { weekday: "short", month: "short", day: "numeric" })} · ${clockLabel(minutesOf(block.start))} – ${clockLabel(minutesOf(block.end))}, Manila time`}
    >
      <Form
        aria-label="Remove the to-do"
        onSubmit={async (formData) => {
          const result = await removeBlockAction(formData);
          if (result.ok) onClose();
          return result;
        }}
      >
        {({ pending }) => (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 type-body-sm text-ink-muted">Only you see this on your calendar.</p>
            <input type="hidden" name="blockId" value={blockId} />
            <Button type="submit" variant="danger" iconLeft="trash" loading={pending}>
              {pending ? "Removing" : "Remove"}
            </Button>
          </div>
        )}
      </Form>
    </Modal>
  );
}
