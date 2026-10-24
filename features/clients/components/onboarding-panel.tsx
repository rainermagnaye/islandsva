"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sendClientOnboarding, withdrawClientOnboarding } from "../actions";
import { ONBOARDING_STATE_LABELS, type OnboardingState, type OnboardingStatus } from "../contract";

const TONES: Record<OnboardingState, BadgeTone> = { not_sent: "neutral", sent: "info", expired: "warning", withdrawn: "neutral", submitted: "success" };
const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/**
 * The onboarding form for a pending client: send, resend or withdraw the link. A fresh link is shown once so it
 * can be copied (for when the email doesn't arrive); it is never stored or shown again.
 */
export function OnboardingPanel({ clientId, status, canSend }: { clientId: string; status: OnboardingStatus; canSend: boolean }) {
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const [fresh, setFresh] = useState<{ link: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const { state, link } = status;

  function send() {
    setProblem(null);
    setCopied(false);
    startTransition(async () => {
      const result = await sendClientOnboarding(clientId);
      if (result.ok) setFresh({ link: result.link, emailed: result.emailed });
      else setProblem(result.message);
    });
  }

  function withdraw() {
    setProblem(null);
    startTransition(async () => {
      const result = await withdrawClientOnboarding(clientId);
      if (result.ok) setFresh(null);
      else setProblem(result.message);
    });
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card as="section" padding="sm" aria-labelledby="onboarding-title" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="onboarding-title" className="m-0 type-label">
          Onboarding form
        </h2>
        <Badge tone={TONES[state]} size="sm">
          {ONBOARDING_STATE_LABELS[state]}
        </Badge>
      </div>

      <p className="m-0 type-body-sm text-ink-muted">
        {state === "submitted"
          ? `The client sent the form${status.submittedAt ? ` on ${when.format(new Date(status.submittedAt))}` : ""}.`
          : state === "sent" && link
            ? `Sent ${when.format(new Date(link.createdAt))}. The link works once and expires ${when.format(new Date(link.expiresAt))}.`
            : state === "expired"
              ? "The last link expired before the client used it. Send a new one."
              : state === "withdrawn"
                ? "The last link was withdrawn. Send a new one when you're ready."
                : "The client fills in their contact, company and billing details, then gives consent."}
      </p>

      {fresh && (
        <div className="grid gap-2">
          <Alert tone={fresh.emailed ? "success" : "warning"} title={fresh.emailed ? "Form sent" : "The email didn't go out"}>
            {fresh.emailed ? "We emailed the link. You can also copy it below." : "Copy the link below and send it to the client yourself."}
          </Alert>
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              aria-label="Onboarding link"
              value={fresh.link}
              onFocus={(event) => event.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-surface-sunken px-3 type-body-sm text-ink"
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => copy(fresh.link)}>
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      )}

      {problem && <Alert tone="danger" title={problem} />}

      {canSend && state !== "submitted" && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" iconLeft="mail" loading={pending} onClick={send}>
            {state === "not_sent" ? "Send onboarding form" : "Send a new link"}
          </Button>
          {state === "sent" && (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={withdraw}>
              Withdraw link
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
