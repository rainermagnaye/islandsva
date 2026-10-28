"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/ui/text-field";
import { VA_MESSAGE_LIMIT, type VaMessageField } from "../contract";
import { sendVaMessage } from "../actions";

export type VaNote = { id: string; body: string; sent: string; author: string };

/** The VA's name and picture, plus a short note the client can leave for them. */
export function VaMessageCard({
  name,
  role,
  avatar,
  vaId,
  messages,
}: {
  name: string;
  role: string;
  avatar?: string;
  vaId: string;
  messages: readonly VaNote[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card as="section" aria-label={name} className="grid content-start gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={name} src={avatar} size="lg" />
        <div className="min-w-0">
          <h2 className="m-0 truncate type-h3">{name}</h2>
          <p className="m-0 type-body-sm text-ink-muted">{role}</p>
        </div>
      </div>
      <Button type="button" variant="secondary" onClick={() => setOpen((openNow) => !openNow)} aria-expanded={open}>
        Message
      </Button>
      {open && (
        <Form<VaMessageField> aria-label="Message" onSubmit={sendVaMessage} className="gap-3">
          {({ pending, fieldErrors }) => (
            <>
              <input type="hidden" name="vaId" value={vaId} />
              <TextField label="Message" name="body" multiline required maxLength={VA_MESSAGE_LIMIT} error={fieldErrors.body} />
              <Button type="submit" variant="secondary" loading={pending}>
                {pending ? "Sending" : "Send message"}
              </Button>
            </>
          )}
        </Form>
      )}
      {messages.length > 0 && (
        <ul className="m-0 grid list-none gap-3 border-t border-border p-0 pt-4">
          {messages.map((message) => (
            <li key={message.id} className="grid gap-1">
              <p className="m-0 type-body-sm">{message.body}</p>
              <p className="m-0 type-body-sm text-ink-muted">
                {message.author} · {message.sent}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
