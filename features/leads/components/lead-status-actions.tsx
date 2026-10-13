"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { changeLeadStatus } from "../actions";
import { TRIAGE_ACTIONS, type LeadStatusField, type TriageStatus } from "../contract";

/**
 * One small form per next status (from nextStatuses), so each button posts its own status and shows its
 * own pending state. On success the server re-renders the page with the new status.
 */
export function LeadStatusActions({ leadId, options }: { leadId: string; options: readonly TriageStatus[] }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {options.map((status) => (
        <Form<LeadStatusField> key={status} aria-label={TRIAGE_ACTIONS[status]} onSubmit={changeLeadStatus}>
          {({ pending }) => (
            <>
              <input type="hidden" name="leadId" value={leadId} />
              <input type="hidden" name="status" value={status} />
              <Button type="submit" variant="ghost" size="sm" loading={pending}>
                {TRIAGE_ACTIONS[status]}
              </Button>
            </>
          )}
        </Form>
      ))}
    </div>
  );
}
