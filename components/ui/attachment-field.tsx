"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { describedBy, Field } from "./field";

/**
 * A file picker whose name is the control. Click the name to rename it in place; the real extension stays.
 * Pictures and recordings preview here. Other files are named only — the page shows them after they are saved.
 */
export function AttachmentField({
  fileName,
  nameField,
  label,
  accept,
  hint,
  optional = true,
  compact = false,
}: {
  fileName: string;
  nameField: string;
  label: string;
  accept: string;
  hint: string;
  optional?: boolean;
  compact?: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    if (editing) nameRef.current?.select();
  }, [editing]);

  function choose(next: File | undefined) {
    const chosen = next && next.size > 0 ? next : null;
    setFile(chosen);
    setTitle(chosen ? chosen.name.replace(/\.[^.]+$/, "") : "");
    setEditing(false);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return chosen ? URL.createObjectURL(chosen) : null;
    });
  }

  const extension = file && file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const shown = file ? `${title.trim() || file.name.replace(/\.[^.]+$/, "")}${extension}` : "";
  const visual = file?.type.startsWith("image/") || file?.type.startsWith("audio/");

  return (
    <Field id={id} label={label} hint={hint} optional={optional} compact={compact}>
      <div className={cx("flex min-w-0 items-center", compact ? "gap-2" : "min-h-11 gap-3")}>
        <input
          ref={inputRef}
          id={id}
          type="file"
          name={fileName}
          accept={accept}
          aria-describedby={describedBy(id, hint)}
          className="sr-only"
          onChange={(event) => choose(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cx(
            "shrink-0 cursor-pointer rounded-md bg-surface-sunken font-semibold text-ink hover:bg-action-ghost-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
            compact ? "h-7 px-2 type-body-sm" : "min-h-11 px-3 py-2 type-body",
          )}
        >
          Choose file
        </button>
        {file ? (
          editing ? (
            <span className={cx("inline-flex min-w-0 items-baseline", compact ? "type-body-sm" : "type-body")}>
              <input
                ref={nameRef}
                aria-label="File name"
                value={title}
                maxLength={180}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => setEditing(false)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setEditing(false);
                  }
                  if (event.key === "Escape") setEditing(false);
                }}
                style={{ width: `${Math.max(title.length, 1)}ch` }}
                className="max-w-full bg-transparent text-ink outline-none focus-visible:underline"
              />
              {extension && <span className="shrink-0 text-ink-muted">{extension}</span>}
            </span>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className={cx("min-h-11 min-w-0 truncate text-left text-ink hover:underline focus-visible:underline", compact ? "type-body-sm" : "type-body")}>
              <span className="sr-only">Rename </span>
              {shown}
            </button>
          )
        ) : (
          <span className="truncate text-ink-muted">No file chosen</span>
        )}
      </div>
      {file && <input type="hidden" name={nameField} value={title} />}
      {file && preview && visual && (
        file.type.startsWith("image/") ? (
          // A local preview of the file just chosen. next/image does not apply to a blob URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="max-h-48 w-full rounded-md border border-border object-contain" />
        ) : (
          <audio controls src={preview} className="w-full" />
        )
      )}
    </Field>
  );
}
