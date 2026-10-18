"use client";

import { Button } from "./button";
import { IconBadge } from "./icon-badge";
import { Modal } from "./modal";

/** A form-level failure: the same centered result dialog as a finished action, with the danger mark. */
export function ErrorDialog({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  return (
    <Modal
      open
      align="center"
      onClose={onClose}
      title={title}
      description={message}
      icon={<IconBadge name="alert" tone="danger" size="xl" />}
      footer={<Button onClick={onClose}>OK</Button>}
    />
  );
}
