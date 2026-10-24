"use client";

import { lazy, Suspense, useState } from "react";
import type { AttachmentKind } from "./attachment-preview-dialog";

// The modal and viewers load on the first click: the VA profile form lists a résumé on first load,
// and shipping the dialog there cost part of the /va budget for something few people open.
// React.lazy rather than next/dynamic: next/dynamic's runtime cost more than the dialog it split off.
const AttachmentPreviewDialog = lazy(() => import("./attachment-preview-dialog").then((m) => ({ default: m.AttachmentPreviewDialog })));

function kindOf(type: string): AttachmentKind {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type === "application/pdf") return "pdf";
  return "other";
}

/** The name on the page. Clicking it opens the file in a modal instead of leaving the page. */
export function AttachmentPreview({ href, name, type }: { href: string; name: string; type: string }) {
  const [open, setOpen] = useState(false);
  // Stays mounted after the first open, so closing goes through dialog.close() and focus returns to this button.
  const [loaded, setLoaded] = useState(false);
  const kind = kindOf(type);

  return (
    <>
      <button type="button" onClick={() => { setLoaded(true); setOpen(true); }} className={kind === "image" ? "grid max-w-xs cursor-pointer gap-1 text-left" : "min-h-11 cursor-pointer text-left type-body-sm text-link"}>
        {kind === "image" && (
          // The file is served by our own route. next/image would add client JS for one preview.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={href} alt="" className="max-h-48 w-full rounded-md border border-border object-contain" />
        )}
        <span className={kind === "image" ? "type-body-sm text-ink" : undefined}>{name}</span>
      </button>
      {loaded && (
        <Suspense fallback={null}>
          <AttachmentPreviewDialog open={open} href={href} name={name} kind={kind} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
