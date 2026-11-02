"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { endClientVa } from "../assignment-actions";

/** Ends one active assignment after a confirm. Used on the VA's page under this client. */
export function ClientAssignmentEnd({ assignmentId }: { assignmentId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function end() {
    setProblem(null);
    startTransition(async () => {
      const result = await endClientVa(assignmentId);
      if (!result.ok) {
        setProblem(result.message);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="grid gap-2">
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" loading={pending} onClick={end}>
            Yes, end the assignment
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          End assignment
        </Button>
      )}
      {problem && <Alert tone="danger" title={problem} />}
    </div>
  );
}
