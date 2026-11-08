"use client";

import { lazy, Suspense, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { generateOnboardingLink } from "../actions";
import type { ClientPackageValues } from "../contract";

// Loaded only when "Set package" is pressed, so the profile doesn't ship the package form up front.
const ClientPackageDialog = lazy(() => import("./client-package-dialog").then((m) => ({ default: m.ClientPackageDialog })));

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

/**
 * The link on the client profile, or a compact button that creates it. Without a package the customer couldn't
 * finish registration, so the card asks for the package first.
 */
export function OnboardingLinkCard({
  clientId,
  url,
  currentPackage,
  packageButton = true,
}: {
  clientId: string;
  url: string | null;
  currentPackage: ClientPackageValues;
  /** false where the page header already has Set package (the admin profile). */
  packageButton?: boolean;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [settingPackage, setSettingPackage] = useState(false);

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setProblem(null);
    startTransition(async () => {
      const result = await generateOnboardingLink(formData);
      if (!result.ok) setProblem(result.message);
    });
  }

  const packageDialog = settingPackage && (
    <Suspense fallback={null}>
      <ClientPackageDialog clientId={clientId} current={currentPackage} onClose={() => setSettingPackage(false)} />
    </Suspense>
  );
  const setPackageButton = packageButton && (
    <Button type="button" size="sm" onClick={() => setSettingPackage(true)}>
      Set package
    </Button>
  );

  if (url) {
    return (
      <Card as="section" padding="sm" className="flex flex-wrap items-end gap-3">
        <CopyLink url={url} />
        {!currentPackage.packageCode && (
          <div className="flex basis-full flex-wrap items-center justify-between gap-3">
            <p className="m-0 type-body-sm text-status-danger">
              This client has no package, so they can&apos;t finish registration. {packageButton ? "Set it now." : "Use Set package above."}
            </p>
            {setPackageButton}
          </div>
        )}
        {packageDialog}
      </Card>
    );
  }

  if (!currentPackage.packageCode) {
    return (
      <Card as="section" padding="sm" className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="m-0 type-label">Registration link</h2>
          <p className="m-0 type-body-sm text-ink-muted">
            Set the package before sending the registration link{packageButton ? "" : " (Set package, above)"}. Their agreement is built from it.
          </p>
        </div>
        {setPackageButton}
        {packageDialog}
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
