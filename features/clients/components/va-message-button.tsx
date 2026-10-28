"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { sendVaMessage } from "../actions";
import { VA_MESSAGE_LIMIT, type VaMessageField } from "../contract";

export type VaNote = { id: string; body: string; sent: string; author: string };

/**
 * "Message <name>" on a VA's profile: a note to the VA in a dialog, with the earlier notes under it. Stays until
 * messaging gets its own module. `compact` is the small "Message" button on a card that already names the VA.
 */
export function VaMessageButton({ name, vaId, messages, compact = false }: { name: string; vaId: string; messages: readonly VaNote[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <Button
        type="button"
        variant={compact ? "ghost" : "secondary"}
        size={compact ? "sm" : "md"}
        iconLeft="message"
        aria-label={compact ? `Message ${name}` : undefined}
        onClick={() => {
          setFormKey((key) => key + 1);
          setOpen(true);
        }}
      >
        {compact ? "Message" : `Message ${name}`}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Message ${name}`}>
        <div className="grid gap-5">
          <Form<VaMessageField>
            key={formKey}
            aria-label={`Message ${name}`}
            onSubmit={async (formData) => {
              const result = await sendVaMessage(formData);
              if (result.ok) setFormKey((key) => key + 1);
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
    </>
  );
}
