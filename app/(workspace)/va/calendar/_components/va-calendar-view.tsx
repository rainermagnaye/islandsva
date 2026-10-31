"use client";

import { lazy, Suspense, useState, type ComponentProps } from "react";
import { PersonCalendar } from "@/features/meetings/components/person-calendar";
import { BLOCK_PREFIX } from "./calendar-events";

const RemoveBlockDialog = lazy(() => import("./remove-block-dialog").then((m) => ({ default: m.RemoveBlockDialog })));

/** The VA's week. A to-do block opens a small dialog to remove it; everything else behaves as PersonCalendar does. */
export function VaCalendarView(props: Omit<ComponentProps<typeof PersonCalendar>, "onExtraSelect">) {
  const [blockId, setBlockId] = useState<string | null>(null);
  const block = props.extras?.find((extra) => extra.event.id === `${BLOCK_PREFIX}${blockId}`)?.event ?? null;

  return (
    <>
      <PersonCalendar {...props} onExtraSelect={(id) => setBlockId(id.startsWith(BLOCK_PREFIX) ? id.slice(BLOCK_PREFIX.length) : null)} />
      {block && blockId && (
        <Suspense fallback={null}>
          <RemoveBlockDialog blockId={blockId} block={block} onClose={() => setBlockId(null)} />
        </Suspense>
      )}
    </>
  );
}
