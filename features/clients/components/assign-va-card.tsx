"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { assignClientVaAction } from "../assignment-actions";
import { vaSlotsLeft, vasForPackage } from "../assistants";

/**
 * The admin picks the client's VA (both, for Day and night) once the payment is approved. The client sees them on
 * first sign-in without choosing, and Send activation stays hidden until every slot is filled. Admins only.
 */
export function AssignVaCard({
  clientId,
  packageCode,
  assignments,
  vas,
}: {
  clientId: string;
  packageCode: string | null;
  assignments: readonly { id: string; vaId: string; vaName: string }[];
  vas: readonly { id: string; fullName: string }[];
}) {
  const wanted = vasForPackage(packageCode);
  if (vaSlotsLeft(packageCode, assignments.length) === 0) return null;
  const taken = new Set(assignments.map((row) => row.vaId));
  const available = vas.filter((va) => !taken.has(va.id));

  return (
    <Card as="section" padding="sm" aria-labelledby="assign-va-title" className="grid gap-4">
      <div className="grid gap-1">
        <h2 id="assign-va-title" className="m-0 type-label">
          {wanted === 2 ? "Assign the day and night VAs" : "Assign the client's VA"}
        </h2>
        <p className="m-0 type-body-sm text-ink-muted">
          {wanted === 2
            ? `This package includes two VAs, one per shift. ${assignments.length} of 2 assigned.`
            : "The client sees this VA as soon as they sign in. They don't need to choose."}
        </p>
      </div>
      {assignments.length > 0 && (
        <ul className="m-0 grid list-none gap-1 p-0">
          {assignments.map((row) => (
            <li key={row.id} className="type-body-sm text-ink">
              <span className="type-label">{row.vaName}</span>
              <span className="text-ink-muted"> · assigned</span>
            </li>
          ))}
        </ul>
      )}
      {available.length === 0 ? (
        <p className="m-0 type-body-sm text-ink-muted">No VA is available to assign. VAs appear here once their profile is approved in Teams.</p>
      ) : (
        <Form<"vaId"> aria-label="Assign a VA" onSubmit={assignClientVaAction} className="gap-3">
          {({ pending, fieldErrors }) => (
            <>
              <input type="hidden" name="clientId" value={clientId} />
              <Select
                compact
                id="assign-va"
                label="VA"
                name="vaId"
                required
                placeholder="Choose a VA"
                options={available.map((va) => ({ value: va.id, label: va.fullName }))}
                error={fieldErrors.vaId}
              />
              <div>
                <Button type="submit" variant="secondary" size="sm" loading={pending}>
                  {pending ? "Assigning" : "Assign VA"}
                </Button>
              </div>
            </>
          )}
        </Form>
      )}
    </Card>
  );
}
