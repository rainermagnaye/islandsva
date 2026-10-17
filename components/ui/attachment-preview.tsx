"use client";

import { useEffect, useState } from "react";
import { Modal } from "./modal";

type Kind = "image" | "audio" | "pdf" | "other";

function kindOf(type: string): Kind {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type === "application/pdf") return "pdf";
  return "other";
}

/** The name on the page. Clicking it opens the file in a modal instead of leaving the page. */
export function AttachmentPreview({ href, name, type }: { href: string; name: string; type: string }) {
  const [open, setOpen] = useState(false);
  const kind = kindOf(type);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={kind === "image" ? "grid max-w-xs cursor-pointer gap-1 text-left" : "min-h-11 cursor-pointer text-left type-body-sm text-link"}>
        {kind === "image" && (
          // The file is served by our own route. next/image would add client JS for one preview.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={href} alt="" className="max-h-48 w-full rounded-md border border-border object-contain" />
        )}
        <span className={kind === "image" ? "type-body-sm text-ink" : undefined}>{name}</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={name} size="lg">
        {open && <PreviewBody href={href} name={name} kind={kind} />}
      </Modal>
    </>
  );
}

function PreviewBody({ href, name, kind }: { href: string; name: string; kind: Kind }) {
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
