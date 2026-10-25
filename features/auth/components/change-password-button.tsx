"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { changePassword } from "../actions";
import { PASSWORD_RULES, type NewPasswordField } from "../contract";

/** Change password from My Profile. The person stays on the page. */
export function ChangePasswordButton() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        iconLeft="shield"
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
      >
        Change password
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={saved ? "Password changed" : "Change password"}
        description={saved ? "Your next sign-in uses the new password." : `At least ${PASSWORD_RULES.min} characters, with letters and numbers.`}
      >
        {saved ? (
          <div className="flex justify-end">
            <Button onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <Form<NewPasswordField>
            aria-label="Change password"
            onSubmit={async (formData) => {
              const result = await changePassword(formData);
              if (result.ok) setSaved(true);
              return result;
            }}
          >
            {({ pending, fieldErrors }) => (
              <div className="grid gap-4">
                <TextField label="New password" name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_RULES.min} maxLength={PASSWORD_RULES.max} error={fieldErrors.password} />
                <TextField label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={PASSWORD_RULES.max} error={fieldErrors.confirmPassword} />
                <div className="flex justify-end">
                  <Button type="submit" loading={pending}>
                    {pending ? "Saving" : "Save password"}
                  </Button>
                </div>
              </div>
            )}
          </Form>
        )}
      </Modal>
    </>
  );
}
