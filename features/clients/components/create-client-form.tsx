"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { addClient } from "../actions";
import { CREATE_CLIENT_LIMITS, type CreateClientField } from "../contract";

/** Company and contact for a client that did not come from a lead. */
export function CreateClientForm({ onAdded }: { onAdded: () => void }) {
  return (
    <Form<CreateClientField>
      aria-label="Create a client"
      onSubmit={async (formData) => {
        const result = await addClient(formData);
        if (result.ok) onAdded();
        return result;
      }}
    >
      {({ pending, fieldErrors }) => (
        <>
          <TextField label="Company" name="companyName" autoComplete="off" required maxLength={CREATE_CLIENT_LIMITS.companyName} error={fieldErrors.companyName} data-autofocus />
          <TextField label="Contact name" name="contactName" autoComplete="off" required maxLength={CREATE_CLIENT_LIMITS.contactName} error={fieldErrors.contactName} />
          <TextField label="Email address" name="contactEmail" type="email" autoComplete="off" required maxLength={CREATE_CLIENT_LIMITS.contactEmail} error={fieldErrors.contactEmail} />
          <TextField label="Phone" name="contactPhone" type="tel" autoComplete="off" optional maxLength={CREATE_CLIENT_LIMITS.contactPhone} error={fieldErrors.contactPhone} />
          <div>
            <Button type="submit" loading={pending} iconLeft="plus">
              {pending ? "Adding" : "Create client"}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
