"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { addClientProfile } from "../actions";
import { NEW_CLIENT_LIMITS, type NewClientField } from "../contract";
import { PackageFields } from "./package-fields";

/** Who the client is and the package agreed on the call. Saving adds a pending client and opens its profile. */
export function NewClientForm() {
  return (
    <Card padding="md">
      <Form<NewClientField> aria-label="New client" onSubmit={addClientProfile}>
        {({ pending, fieldErrors }) => (
          <>
            <TextField label="Company" name="companyName" required maxLength={NEW_CLIENT_LIMITS.companyName} error={fieldErrors.companyName} />
            <TextField label="Contact name" name="contactName" required autoComplete="off" maxLength={NEW_CLIENT_LIMITS.contactName} error={fieldErrors.contactName} />
            <TextField
              label="Contact email"
              name="contactEmail"
              type="email"
              required
              autoComplete="off"
              maxLength={NEW_CLIENT_LIMITS.contactEmail}
              hint="The onboarding form and their login go to this address."
              error={fieldErrors.contactEmail}
            />
            <TextField label="Contact phone" name="contactPhone" type="tel" optional autoComplete="off" maxLength={NEW_CLIENT_LIMITS.contactPhone} error={fieldErrors.contactPhone} />
            <PackageFields fieldErrors={fieldErrors} />
            <div className="border-t border-border pt-4">
              <Button type="submit" loading={pending}>
                {pending ? "Adding" : "Add client"}
              </Button>
            </div>
          </>
        )}
      </Form>
    </Card>
  );
}
