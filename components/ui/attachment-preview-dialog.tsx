"use client";

import { useEffect, useState } from "react";
import { Modal } from "./modal";

export type AttachmentKind = "image" | "audio" | "pdf" | "other";

/** The open preview. Loaded only when someone opens a file, so pages that list files don't ship it. */
export function AttachmentPreviewDialog({ open, href, name, kind, onClose }: { open: boolean; href: string; name: string; kind: AttachmentKind; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={name} size="lg">
      {open && <PreviewBody href={href} name={name} kind={kind} />}
    </Modal>
  );
}

function PreviewBody({ href, name, kind }: { href: string; name: string; kind: AttachmentKind }) {
  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={href} alt="" className="max-h-[70dvh] w-full object-contain" />
    );
  }
  if (kind === "audio") return <audio controls src={href} className="w-full" />;
  if (kind === "pdf") return <PdfFrame href={href} name={name} />;
  return (
    <p className="m-0 text-ink-muted">
      This file can&apos;t be shown here.{" "}
      <a href={href} download={name}>
        Download {name}
      </a>
    </p>
  );
}

/**
 * The download route sends X-Frame-Options: DENY, so an iframe of that URL is blank.
 * The bytes are read here and framed as a blob, which the page is allowed to show.
 */
function PdfFrame({ href, name }: { href: string; name: string }) {
  const [url, setUrl] = useState<string | null>(href.startsWith("blob:") ? href : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (href.startsWith("blob:")) return;
    const controller = new AbortController();
    let cancelled = false;
    let created: string | null = null;
    fetch(href, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Preview failed (${response.status})`);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const typed = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
        created = URL.createObjectURL(typed);
        setUrl(created);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setFailed(true);
      });
    return () => {
      cancelled = true;
      controller.abort();
      if (created) URL.revokeObjectURL(created);
    };
  }, [href]);

  if (failed) {
    return (
      <p className="m-0 text-ink-muted">
        This file couldn&apos;t be previewed.{" "}
        <a href={href} download={name}>
          Download {name}
        </a>
      </p>
    );
  }
  if (!url) return <p className="m-0 text-ink-muted">Loading the preview…</p>;
  return <iframe title={name} src={url} className="h-[70dvh] w-full rounded-md border border-border bg-surface-card" />;
}
