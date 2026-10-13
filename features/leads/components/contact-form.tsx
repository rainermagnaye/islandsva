"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Form, FormSuccess } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { packages } from "@/content/packages";
import { routes } from "@/content/routes";
import { submitLead } from "../api-client";
import { LEAD_LIMITS, type LeadField, type LeadPayload } from "../contract";
import { Turnstile } from "./turnstile";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function submit(formData: FormData) {
  const value = (name: string) => String(formData.get(name) ?? "");
  const payload: LeadPayload = {
    name: value("name"),
    email: value("email"),
    company: value("company"),
    package: value("package"),
    message: value("message"),
    website: value("website"),
    turnstileToken: value("cf-turnstile-response"),
  };
  return submitLead(payload);
}

/** Reads ?package= so "Choose Executive" buttons preselect the package. */
export function ContactFormWithParams() {
  const selected = useSearchParams().get("package") ?? "";
  return <ContactForm defaultPackage={packages.some((p) => p.slug === selected) ? selected : ""} />;
}

export function ContactForm({ defaultPackage = "" }: { defaultPackage?: string }) {
  const turnstileId = useRef<string | null>(null);
  const handleTurnstileRender = useCallback((id: string | null) => {
    turnstileId.current = id;
  }, []);
  // Turnstile tokens are single-use, so every failed submit needs a fresh one.
  const resetTurnstile = useCallback(() => {
    if (turnstileId.current) window.turnstile?.reset(turnstileId.current);
  }, []);

  return (
    <Form<LeadField>
      aria-label="Book a discovery call"
      onSubmit={submit}
      onError={resetTurnstile}
      success={
        <FormSuccess title="Got it — thank you">
          We&apos;ve received your message and will reply within one business day to set up your discovery call.
        </FormSuccess>
      }
      className="rounded-lg border border-border bg-surface-card p-6 md:p-8"
    >
      {({ pending, fieldErrors }) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Full name" name="name" autoComplete="name" required maxLength={LEAD_LIMITS.name} error={fieldErrors.name} />
            <TextField label="Work email" name="email" type="email" autoComplete="email" required maxLength={LEAD_LIMITS.email} error={fieldErrors.email} />
          </div>
          <TextField label="Company" name="company" autoComplete="organization" optional maxLength={LEAD_LIMITS.company} error={fieldErrors.company} />
          <Select
            label="Package you're interested in"
            name="package"
            optional
            defaultValue={defaultPackage}
            options={[{ value: "", label: "Not sure yet" }, ...packages.map((p) => ({ value: p.slug, label: `${p.name} — ${p.hoursPerWeek}` }))]}
            error={fieldErrors.package}
          />
          <TextField
            label="How can we help?"
            name="message"
            multiline
            rows={5}
            required
            maxLength={LEAD_LIMITS.message}
            hint="The tasks you'd hand off first, your time zone and when you'd like to start."
            error={fieldErrors.message}
          />

          {/* Honeypot: hidden from people and assistive tech; bots that fill it are silently dropped. */}
          <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          {TURNSTILE_SITE_KEY && <Turnstile siteKey={TURNSTILE_SITE_KEY} onRender={handleTurnstileRender} />}

          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" size="lg" loading={pending}>
              {pending ? "Sending" : "Request my discovery call"}
            </Button>
            <p className="m-0 type-body-sm text-ink-muted">
              We&apos;ll only use your details to reply. See our <Link href={routes.privacy}>privacy policy</Link>.
            </p>
          </div>
        </>
      )}
    </Form>
  );
}
