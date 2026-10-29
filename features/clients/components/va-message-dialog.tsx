"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { sendVaMessage } from "../actions";
import { VA_MESSAGE_LIMIT, type VaMessageField } from "../contract";
import type { VaNote } from "./va-message-button";

/** The message dialog opened from VaMessageButton. Loaded on click so the profile page doesn't ship the form. */
export function VaMessageDialog({
  name,
  vaId,
  messages,
  formKey,
  onClose,
  onSent,
}: {
  name: string;
  vaId: string;
  messages: readonly VaNote[];
  formKey: number;
  onClose: () => void;
  onSent: () => void;
}) {
  return (
    <Modal open onClose={onClose} title={`Message ${name}`}>
      <div className="grid gap-5">
        <Form<VaMessageField>
          key={formKey}
          aria-label={`Message ${name}`}
          onSubmit={async (formData) => {
            const result = await sendVaMessage(formData);
            if (result.ok) onSent();
            return result;
          }}
          className="gap-3"
        >
          {({ pending, fieldErrors }) => (
            <>
              <input type="hidden" name="vaId" value={vaId} />
              <TextField label="Message" name="body" multiline required maxLength={VA_MESSAGE_LIMIT} error={fieldErrors.body} data-autofocus />
              <div className="flex justify-end">
                <Button type="submit" variant="secondary" loading={pending}>
                  {pending ? "Sending" : "Send message"}
                </Button>
              </div>
            </>
          )}
        </Form>
        {messages.length > 0 && (
          <section aria-label="Earlier messages" className="grid gap-3 border-t border-border pt-4">
            <h3 className="m-0 type-label text-ink-muted">Earlier messages</h3>
            <ul className="m-0 grid list-none gap-3 p-0">
              {messages.map((message) => (
                <li key={message.id} className="grid gap-1">
                  <p className="m-0 type-body-sm whitespace-pre-line">{message.body}</p>
                  <p className="m-0 type-caption text-ink-muted">
                    {message.author} · {message.sent}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}
