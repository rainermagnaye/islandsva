"use client";

import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { clockLabel, formatDate, minutesOf } from "@/components/ui/date-math";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { PersonCalendar } from "@/features/meetings/components/person-calendar";
import { removeBlockAction } from "@/features/tasks/actions";
import { BLOCK_PREFIX } from "./calendar-events";

/** The VA's week. A to-do block opens a small dialog to remove it; everything else behaves as PersonCalendar does. */
export function VaCalendarView(props: Omit<ComponentProps<typeof PersonCalendar>, "onExtraSelect">) {
  const [blockId, setBlockId] = useState<string | null>(null);
  const block = props.extras?.find((extra) => extra.event.id === `${BLOCK_PREFIX}${blockId}`)?.event ?? null;

  return (
    <>
      <PersonCalendar {...props} onExtraSelect={(id) => setBlockId(id.startsWith(BLOCK_PREFIX) ? id.slice(BLOCK_PREFIX.length) : null)} />
      <Modal
        open={block !== null}
        onClose={() => setBlockId(null)}
        title={block?.title ?? "To-do"}
        description={block ? `${formatDate(block.start.slice(0, 10), { weekday: "short", month: "short", day: "numeric" })} · ${clockLabel(minutesOf(block.start))} – ${clockLabel(minutesOf(block.end))}, Manila time` : undefined}
      >
        <Form
          aria-label="Remove the to-do"
          onSubmit={async (formData) => {
            const result = await removeBlockAction(formData);
            if (result.ok) setBlockId(null);
            return result;
          }}
        >
          {({ pending }) => (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 type-body-sm text-ink-muted">Only you see this on your calendar.</p>
              <input type="hidden" name="blockId" value={blockId ?? ""} />
              <Button type="submit" variant="danger" iconLeft="trash" loading={pending}>
                {pending ? "Removing" : "Remove"}
              </Button>
            </div>
          )}
        </Form>
      </Modal>
    </>
  );
}
