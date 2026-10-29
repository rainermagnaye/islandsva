"use client";

import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";

export type VaNote = { id: string; body: string; sent: string; author: string };

const VaMessageDialog = lazy(() => import("./va-message-dialog").then((m) => ({ default: m.VaMessageDialog })));

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
      {open && (
        <Suspense fallback={null}>
          <VaMessageDialog
            name={name}
            vaId={vaId}
            messages={messages}
            formKey={formKey}
            onClose={() => setOpen(false)}
            onSent={() => setFormKey((key) => key + 1)}
          />
        </Suspense>
      )}
    </>
  );
}
