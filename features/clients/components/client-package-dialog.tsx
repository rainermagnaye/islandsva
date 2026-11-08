"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { saveClientPackageAction } from "../actions";
import type { ClientPackageField, ClientPackageValues } from "../contract";
import { PackageFields } from "./package-fields";

/**
 * Sets or changes a pending client's package. If they already accepted the agreement, they accept the new terms
 * again before the registration can be approved.
 */
export function ClientPackageDialog({ clientId, current, onClose }: { clientId: string; current: ClientPackageValues; onClose: () => void }) {
  const setting = !current.packageCode;

  return (
    <Modal
      open
      onClose={onClose}
      title={setting ? "Set package" : "Change package"}
      description={
        setting
          ? "The package they'll start on. The registration link needs one before it can be sent."
          : "If they already accepted the agreement, they'll accept the new terms before you can approve."
      }
    >
      <Form<ClientPackageField>
        aria-label={setting ? "Set package" : "Change package"}
        onSubmit={async (formData) => {
          const result = await saveClientPackageAction(formData);
          if (result.ok) onClose();
          return result;
        }}
      >
        {({ pending, fieldErrors }) => (
          <>
            <input type="hidden" name="clientId" value={clientId} />
            <PackageFields current={current} fieldErrors={fieldErrors} />
            <div className="mt-1 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                {pending ? "Saving" : "Save package"}
              </Button>
            </div>
          </>
        )}
      </Form>
    </Modal>
  );
}
