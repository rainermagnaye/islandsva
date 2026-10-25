"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { generateOnboardingLink } from "../actions";

/** Copies the stable registration URL. The button sits on the same line as the field. */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1 basis-64">
        <TextField
          label="Registration link"
          name="registrationLink"
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          onChange={() => {}}
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}

/** The link on the client profile, or a compact button that creates it. */
export function OnboardingLinkCard({ clientId, url }: { clientId: string; url: string | null }) {
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setProblem(null);
    startTransition(async () => {
      const result = await generateOnboardingLink(formData);
      if (!result.ok) setProblem(result.message);
    });
  }

  if (url) {
    return (
      <Card as="section" padding="sm" className="flex flex-wrap items-end gap-3">
        <CopyLink url={url} />
      </Card>
    );
  }

  return (
    <Card as="section" padding="sm" className="flex flex-wrap items-center justify-between gap-3">
      <div className="grid gap-1">
        <h2 className="m-0 type-label">Registration link</h2>
        <p className="m-0 type-body-sm text-ink-muted">Generate the link they use to finish registration. They don&apos;t sign in.</p>
      </div>
      <form onSubmit={generate} className="flex items-center">
        <input type="hidden" name="clientId" value={clientId} />
        <Button type="submit" size="sm" loading={pending}>
          {pending ? "Creating link" : "Generate registration link"}
        </Button>
      </form>
      {problem && <p className="m-0 basis-full type-body-sm text-status-danger">{problem}</p>}
    </Card>
  );
}
