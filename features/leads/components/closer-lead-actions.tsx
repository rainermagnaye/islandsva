"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { saveLeadStep } from "../actions";
import { LEAD_EVENT_LIMIT, type LeadDetail } from "../contract";

const CLOSER_STEP = {
  new: { kind: "call", label: "Book demo", title: "Book a demo", prompt: "Demo notes" },
  contacted: { kind: "qualification", label: "Qualified", title: "Mark as qualified", prompt: "Qualification details" },
} as const;

/** Pipeline button for a Lead Gen: Book demo, then Qualified. Admin convert / delete stay off this page. */
export function CloserLeadActions({ lead }: { lead: LeadDetail }) {
  const [open, setOpen] = useState(false);
  const step = lead.status === "new" || lead.status === "contacted" ? CLOSER_STEP[lead.status] : null;
  const working = !lead.disabledAt && lead.status !== "converted" && lead.status !== "closed";
  if (!working || !step) return null;

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {step.label}
      </Button>
      {open ? (
        <Modal open onClose={() => setOpen(false)} title={step.title}>
          <Form
            aria-label={step.title}
            onSubmit={async (formData) => {
              const result = await saveLeadStep(formData);
              if (result.ok) setOpen(false);
              return result;
            }}
          >
            {({ pending, fieldErrors }) => (
              <>
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="kind" value={step.kind} />
                <TextField label={step.prompt} name="body" multiline required maxLength={LEAD_EVENT_LIMIT} data-autofocus error={fieldErrors.body} />
                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={pending}>
                    {pending ? "Saving" : "Save"}
                  </Button>
                </div>
              </>
            )}
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
