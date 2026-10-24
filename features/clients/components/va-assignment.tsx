"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { assignClientVa, endClientVa } from "../assignment-actions";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** The client's VA (admins only): assign one approved VA, or end the current assignment. History is kept. */
export function VaAssignment({
  clientId,
  assignment,
  vas,
}: {
  clientId: string;
  assignment: { vaName: string; startedAt: string } | null;
  vas: readonly { id: string; fullName: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function end() {
    setProblem(null);
    startTransition(async () => {
      const result = await endClientVa(clientId);
      if (!result.ok) setProblem(result.message);
      setConfirming(false);
    });
  }

  return (
    <Card as="section" padding="sm" aria-labelledby="va-title" className="grid gap-3">
      <h2 id="va-title" className="m-0 type-label">
        Virtual assistant
      </h2>
      {assignment ? (
        <>
          <p className="m-0 type-body-sm text-ink">
            <span className="type-label">{assignment.vaName}</span>
            <span className="text-ink-muted"> · since {day.format(new Date(assignment.startedAt))}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {confirming ? (
              <>
                <Button type="button" variant="secondary" size="sm" loading={pending} onClick={end}>
                  Yes, end the assignment
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                End assignment
              </Button>
            )}
          </div>
        </>
      ) : vas.length === 0 ? (
        <p className="m-0 type-body-sm text-ink-muted">No VA is available yet. VAs appear here once their profile is approved in Teams.</p>
      ) : (
        <Form<"vaId"> aria-label="Assign a VA" onSubmit={assignClientVa} className="gap-3">
          {({ pending: saving, fieldErrors }) => (
            <>
              <input type="hidden" name="clientId" value={clientId} />
              <Select compact label="Assign a VA" name="vaId" required placeholder="Choose a VA" options={vas.map((va) => ({ value: va.id, label: va.fullName }))} error={fieldErrors.vaId} />
              <div>
                <Button type="submit" variant="secondary" size="sm" loading={saving}>
                  {saving ? "Assigning" : "Assign VA"}
                </Button>
              </div>
            </>
          )}
        </Form>
      )}
      {problem && <Alert tone="danger" title={problem} />}
    </Card>
  );
}
