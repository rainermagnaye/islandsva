"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteDemoSlot } from "../actions";

/** Removes one open slot. The only client JS on a row of the calendar. */
export function DeleteSlotButton({ slotId, label }: { slotId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-2">
      {problem && (
        <span role="alert" className="type-body-sm text-status-danger">
          {problem}
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={pending}
        aria-label={`Remove the ${label} slot`}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteDemoSlot(slotId);
            setProblem(result.ok ? null : result.message);
          })
        }
      >
        Remove
      </Button>
    </span>
  );
}
