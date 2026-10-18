"use client";

import { useState } from "react";
import { AttachmentField } from "@/components/ui/attachment-field";
import { AttachmentPreview } from "@/components/ui/attachment-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { adminClientHref } from "@/content/routes";
import { saveClientNote } from "../actions";
import { CLIENT_ATTACHMENT_ACCEPT, acceptClientAttachment } from "../attachment";
import { CLIENT_NOTE_LIMIT, type ClientNote, type ClientNoteField } from "../contract";

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Notes on this client, newest first, each with an optional file. */
export function ClientNotes({ clientId, notes }: { clientId: string; notes: readonly ClientNote[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card as="section" padding="none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="m-0 type-label">Notes</h2>
          <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
            Add note
          </Button>
        </div>
        {notes.length === 0 ? (
          <div className="p-4">
            <EmptyState compact headingLevel={3} title="No notes yet" description="Notes and files you add for this client show up here." />
          </div>
        ) : (
          <ol className="m-0 grid list-none gap-0 p-4">
            {notes.map((note, index) => (
              <li key={note.id} className="grid grid-cols-[1.25rem_1fr] gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-action-secondary" />
                  {index < notes.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                </div>
                <div className={index < notes.length - 1 ? "grid gap-1 pb-5" : "grid gap-1"}>
                  <p className="m-0 whitespace-pre-line type-body-sm text-ink">{note.body}</p>
                  {note.attachmentName && note.attachmentType && (
                    <AttachmentPreview href={`${adminClientHref(clientId)}/files/${note.id}`} name={note.attachmentName} type={note.attachmentType} />
                  )}
                  <p className="m-0 type-body-sm text-ink-muted">
                    <time dateTime={note.createdAt}>{`${when.format(new Date(note.createdAt))} UTC`}</time>
                    {" · "}
                    {note.authorName}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
      {open && <NoteDialog clientId={clientId} onClose={() => setOpen(false)} />}
    </>
  );
}

function NoteDialog({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Add note">
      <Form<ClientNoteField> aria-label="Add note" onSubmit={async (formData) => {
        const file = formData.get("attachment");
        const title = formData.get("attachmentName");
        if (file instanceof File && file.size > 0) {
          const accepted = acceptClientAttachment(file, typeof title === "string" ? title : "");
          if (!accepted.ok) return { ok: false, message: accepted.message };
        }
        const result = await saveClientNote(formData);
        if (result.ok) onClose();
        return result;
      }}>
        {({ pending, fieldErrors }) => (
          <>
            <input type="hidden" name="clientId" value={clientId} />
            <TextField label="Note" name="body" multiline required maxLength={CLIENT_NOTE_LIMIT} data-autofocus error={fieldErrors.body} />
            <AttachmentField fileName="attachment" nameField="attachmentName" label="Attachment" accept={CLIENT_ATTACHMENT_ACCEPT} hint="A recording, PDF or image, up to 2 MB. Click the name to rename it." />
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
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
  );
}
