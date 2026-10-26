"use client";

import { useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import type { SubmitResult } from "@/types/form";
import { REVIEW_SECTIONS, REVIEW_SECTION_LABELS, EMPLOYEE_LIMITS } from "../contract";
import { confirmEmployee, returnEmployee } from "../actions";

/** Confirm is the one primary action. Return opens a dialog for the sections that need a change. The menu sits after both. */
export function EmployeeReviewActions({ userId, name, menu }: { userId: string; name: string; menu: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setPending(true);
    setError(undefined);
    try {
      const result = await confirmEmployee(userId);
      if (!result.ok) setError(result.message);
    } catch {
      setError("We couldn't confirm that profile. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function sendBack(formData: FormData): Promise<SubmitResult<"note" | "sections">> {
    formData.set("userId", userId);
    try {
      const result = await returnEmployee(formData);
      if (result.ok) setOpen(false);
      return result;
    } catch {
      return { ok: false, message: "We couldn't send that profile back. Check your connection and try again." };
    }
  }

  return (
    <div className="ml-auto grid justify-items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button onClick={confirm} loading={pending}>
          {pending ? "Saving" : "Confirm profile"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(true)} disabled={pending}>
          Return for changes
        </Button>
        {menu}
      </div>
      {error && <Alert tone="danger" title={error} />}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Send this profile back?"
        description={`${name} will see only the sections you choose.`}
        footer={
          <>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button type="submit" form="return-profile">
              Send it back
            </Button>
          </>
        }
      >
        <Form id="return-profile" aria-label="Sections to send back" onSubmit={sendBack}>
          {({ pending: sending, fieldErrors }) => (
            <div className="grid gap-3">
              {REVIEW_SECTIONS.map((section) => (
                <Checkbox key={section} name="section" value={section} label={REVIEW_SECTION_LABELS[section]} />
              ))}
              {fieldErrors.sections && <Alert tone="danger" title={fieldErrors.sections} />}
              <TextField label="Note" name="note" optional multiline maxLength={EMPLOYEE_LIMITS.returnNote} placeholder="What should they change?" error={fieldErrors.note} />
              <span className="sr-only">{sending ? "Sending" : ""}</span>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
}
