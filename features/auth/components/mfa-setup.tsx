"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { startMfaEnrollment } from "../actions";
import type { MfaEnrollment } from "../contract";
import { MfaCodeForm } from "./mfa-code-form";

/** First-time authenticator setup: create the factor on demand (not on page load), scan, confirm a code. */
export function MfaSetup() {
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startMfaEnrollment();
      if (result.ok) setEnrollment(result);
      else setError(result.message);
    });
  }

  if (!enrollment) {
    return (
      <div className="grid justify-items-start gap-4">
        {error && (
          <p role="alert" className="m-0 flex items-start gap-2 rounded-md bg-status-danger-bg p-4 type-label text-status-danger">
            <Icon name="alert" className="mt-0.5" />
            {error}
          </p>
        )}
        <Button onClick={start} loading={pending} iconLeft="shield">
          {pending ? "Preparing" : "Set up authenticator app"}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <ol className="m-0 grid gap-2 pl-5 text-ink-muted">
        <li>Open an authenticator app (Google Authenticator, 1Password, Microsoft Authenticator…).</li>
        <li>Scan this code, or enter the setup key by hand.</li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      <div className="grid justify-items-start gap-3">
        {/* Supabase returns the QR code as an SVG data URL: no extra library or network request. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing for next/image to optimise */}
        <img src={enrollment.qrCode} alt="QR code for your authenticator app" width={176} height={176} className="rounded-md bg-brand-sand p-2" />
        <p className="m-0 type-body-sm text-ink-muted">
          Setup key: <code className="break-all font-mono text-ink">{enrollment.secret}</code>
        </p>
      </div>
      <MfaCodeForm factorId={enrollment.factorId} submitLabel="Turn on two-factor sign-in" />
    </div>
  );
}
