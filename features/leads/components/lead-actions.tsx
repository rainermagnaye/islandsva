"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/button";
import { cardSurface } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { AttachmentField } from "@/components/ui/attachment-field";
import { TextField } from "@/components/ui/text-field";
import { adminLeadHref } from "@/content/routes";
import { cx } from "@/lib/cx";
import { deleteLead, saveLeadStep, setLeadPaused } from "../actions";
import { LEAD_ATTACHMENT_ACCEPT, acceptLeadAttachment } from "../attachment";
import { LEAD_EVENT_LIMIT, PIPELINE_STEP, type LeadDetail } from "../contract";
import { ConvertDialog } from "./convert-dialog";

type Dialog = "step" | "junk" | "convert" | "pause" | "delete" | null;

/** Pipeline button and the edit / disable / delete menu. Each write opens a dialog first. */
export function LeadActions({ lead, canDelete, editing }: { lead: LeadDetail; canDelete: boolean; editing: boolean }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const step = lead.status === "new" || lead.status === "contacted" ? PIPELINE_STEP[lead.status] : null;
  const working = !lead.disabledAt && lead.status !== "converted" && lead.status !== "closed";
  const close = () => setDialog(null);
  const openDialog = (next: Exclude<Dialog, null>) => {
    const details = menu.current;
    if (details) details.open = false;
    setDialog(next);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {working && step && (
          <Button type="button" onClick={() => setDialog("step")}>
            {step.label}
          </Button>
        )}
        {working && lead.status === "qualified" && (
          <Button type="button" onClick={() => setDialog("convert")}>
            Mark as Converted
          </Button>
        )}
        {lead.status !== "closed" && (
          <button
            type="button"
            aria-label="Mark as junk"
            onClick={() => setDialog("junk")}
            className={buttonClasses({ variant: "ghost", className: "size-11 cursor-pointer px-0" })}
          >
            <Icon name="trash" />
          </button>
        )}
        <details ref={menu} className="relative">
          <summary aria-label="Lead actions" className={buttonClasses({ variant: "ghost", className: "size-11 cursor-pointer list-none px-0 marker:content-none [&::-webkit-details-marker]:hidden" })}>
            <Icon name="menu" />
          </summary>
          <ul className={cx(cardSurface, "absolute right-0 z-20 m-0 mt-2 grid w-48 list-none gap-1 p-2 elevation-md")}>
            <MenuItem
              icon="edit"
              label={editing ? "Close editor" : "Edit profile"}
              onClick={() => {
                const details = menu.current;
                if (details) details.open = false;
                router.push(editing ? adminLeadHref(lead.id) : `${adminLeadHref(lead.id)}?edit=1`);
              }}
            />
            <MenuItem icon={lead.disabledAt ? "check" : "x-circle"} label={lead.disabledAt ? "Enable" : "Disable"} onClick={() => openDialog("pause")} />
            {canDelete && <MenuItem icon="trash" label="Delete" danger onClick={() => openDialog("delete")} />}
          </ul>
        </details>
      </div>

      {dialog === "step" && step && (
        <RemarkDialog title={step.title} label={step.prompt} kind={step.kind} leadId={lead.id} allowFile={step.kind === "call"} onClose={close} />
      )}
      {dialog === "junk" && (
        <RemarkDialog
          title="Mark as junk"
          label="Why is this a junk lead?"
          kind="junk"
          leadId={lead.id}
          onClose={close}
          submitLabel="Mark as junk"
          blocked={lead.status === "converted" ? "This lead is already a client, so it can't be marked as junk." : lead.disabledAt ? "Enable this lead before marking it as junk." : undefined}
        />
      )}
      {dialog === "convert" && <ConvertDialog lead={lead} onClose={close} />}
      {dialog === "pause" && <ConfirmDialog leadId={lead.id} disabled={!lead.disabledAt} onClose={close} />}
      {dialog === "delete" && <DeleteDialog leadId={lead.id} onClose={close} />}
    </>
  );
}

/** Opens a timeline dialog from the history section. */
export function TimelineButtons({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Add note
      </Button>
      {open && <RemarkDialog title="Add note" label="Note" kind="note" leadId={leadId} allowFile onClose={() => setOpen(false)} />}
    </>
  );
}

function MenuItem({ icon, label, onClick, danger = false }: { icon: "edit" | "trash" | "check" | "x-circle"; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cx("flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left type-menu hover:bg-action-ghost-hover", danger ? "text-status-danger" : "text-ink")}
      >
        <Icon name={icon} size={18} />
        {label}
      </button>
    </li>
  );
}

function RemarkDialog({ title, label, kind, leadId, allowFile = false, onClose, submitLabel = "Save", blocked }: { title: string; label: string; kind: string; leadId: string; allowFile?: boolean; onClose: () => void; submitLabel?: string; blocked?: string }) {
  return (
    <Modal open onClose={onClose} title={title}>
      <Form aria-label={title} onSubmit={async (formData) => {
        if (blocked) return { ok: false, message: blocked };
        const file = formData.get("attachment");
        const title = formData.get("attachmentName");
        if (file instanceof File && file.size > 0) {
          const accepted = acceptLeadAttachment(file, typeof title === "string" ? title : "");
          if (!accepted.ok) return { ok: false, message: accepted.message };
        }
        const result = await saveLeadStep(formData);
        if (result.ok) onClose();
        return result;
      }}>
        {({ pending, fieldErrors }) => (
          <>
            <input type="hidden" name="leadId" value={leadId} />
            <input type="hidden" name="kind" value={kind} />
            <TextField label={label} name="body" multiline required maxLength={LEAD_EVENT_LIMIT} data-autofocus error={fieldErrors.body} />
            {allowFile && (
              <AttachmentField fileName="attachment" nameField="attachmentName" label="Attachment" accept={LEAD_ATTACHMENT_ACCEPT} hint="A recording, PDF or image, up to 2 MB. Click the name to rename it." />
            )}
            <DialogButtons pending={pending} onClose={onClose} submitLabel={submitLabel} />
          </>
        )}
      </Form>
    </Modal>
  );
}

function ConfirmDialog({ leadId, disabled, onClose }: { leadId: string; disabled: boolean; onClose: () => void }) {
  const title = disabled ? "Disable lead" : "Enable lead";
  return (
    <Modal open onClose={onClose} title={title} description={disabled ? "This lead leaves the lead list until you enable them. The timeline stays." : "This lead shows on the lead list again."}>
      <Form aria-label={title} onSubmit={async (formData) => {
        const result = await setLeadPaused(formData);
        if (result.ok) onClose();
        return result;
      }}>
        {({ pending }) => (
          <>
            <input type="hidden" name="leadId" value={leadId} />
            <input type="hidden" name="disabled" value={disabled ? "true" : "false"} />
            <DialogButtons pending={pending} onClose={onClose} submitLabel={disabled ? "Disable" : "Enable"} />
          </>
        )}
      </Form>
    </Modal>
  );
}

function DeleteDialog({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Delete lead" description="This removes the lead. It is only available when there is no timeline yet.">
      <Form aria-label="Delete lead" onSubmit={deleteLead}>
        {({ pending }) => (
          <>
            <input type="hidden" name="leadId" value={leadId} />
            <DialogButtons pending={pending} onClose={onClose} submitLabel="Delete" danger />
          </>
        )}
      </Form>
    </Modal>
  );
}

function DialogButtons({ pending, onClose, submitLabel = "Save", danger = false }: { pending: boolean; onClose: () => void; submitLabel?: string; danger?: boolean }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
      <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" variant={danger ? "danger" : "primary"} loading={pending}>
        {pending ? "Saving" : submitLabel}
      </Button>
    </div>
  );
}
