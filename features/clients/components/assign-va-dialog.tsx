"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { assignClientVaAction } from "../assignment-actions";
import { vasForPackage } from "../assistants";

/**
 * "Assign VA" in the profile header while the package has a free slot: before activation (Send activation stays
 * hidden until every slot is filled) and for an active client short of their package. The client sees the VA on
 * sign-in without choosing. Admins only; assign_client_va checks again.
 */
export function AssignVa({
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
  const [open, setOpen] = useState(false);
  const wanted = vasForPackage(packageCode);
  const taken = new Set(assignments.map((row) => row.vaId));
  const available = vas.filter((va) => !taken.has(va.id));
  const description =
    wanted === 2
      ? `Day and night includes two VAs, one per shift. ${assignments.length} of 2 assigned${
          assignments.length > 0 ? `: ${assignments.map((row) => row.vaName).join(", ")}` : ""
        }.`
      : "The client sees this VA as soon as they sign in. They don't need to choose.";

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Assign VA
      </Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title={wanted === 2 ? "Assign a VA" : "Assign the client's VA"} description={description}>
          {available.length === 0 ? (
            <>
              <p className="m-0 mt-4 type-body-sm text-ink-muted">No VA is available to assign. VAs appear here once their profile is approved in Teams.</p>
              <div className="mt-6 flex justify-end border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            </>
          ) : (
            <Form<"vaId">
              aria-label="Assign a VA"
              onSubmit={async (formData) => {
                const result = await assignClientVaAction(formData);
                if (result.ok) setOpen(false);
                return result;
              }}
            >
              {({ pending, fieldErrors }) => (
                <>
                  <input type="hidden" name="clientId" value={clientId} />
                  <div className="mt-4">
                    <Select
                      id="assign-va"
                      label="VA"
                      name="vaId"
                      required
                      placeholder="Choose a VA"
                      options={available.map((va) => ({ value: va.id, label: va.fullName }))}
                      error={fieldErrors.vaId}
                      data-autofocus
                    />
                  </div>
                  <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                      Cancel
                    </Button>
                    <Button type="submit" loading={pending}>
                      {pending ? "Assigning" : "Assign VA"}
                    </Button>
                  </div>
                </>
              )}
            </Form>
          )}
        </Modal>
      )}
    </>
  );
}
