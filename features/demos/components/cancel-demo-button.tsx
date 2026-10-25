"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cancelDemoAction } from "../booking-actions";

/** Cancels the client's open demo, after a confirm step. */
export function CancelDemoButton({ bookingId }: { bookingId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function cancel() {
    setProblem(null);
    startTransition(async () => {
      const result = await cancelDemoAction(bookingId);
      if (!result.ok) setProblem(result.message);
      setConfirming(false);
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {confirming ? (
          <>
            <Button type="button" variant="secondary" size="sm" loading={pending} onClick={cancel}>
              Yes, cancel the call
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Cancel demo
          </Button>
        )}
      </div>
      {problem && <Alert tone="danger" title={problem} />}
    </div>
  );
}
