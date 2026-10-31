"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cardSurface } from "@/components/ui/card";
import { Form, FormSuccess } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper } from "@/components/ui/stepper";
import { TextField } from "@/components/ui/text-field";
import { COUNTRIES } from "@/content/countries";
import { packages } from "@/content/packages";
import { routes } from "@/content/routes";
import { submitLead } from "../api-client";
import { INDUSTRIES, LEAD_LIMITS, type LeadField, type LeadPayload } from "../contract";
import { Turnstile } from "./turnstile";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// The calendar and time picker load when the visitor reaches step 2, keeping them off /contact's first load.
const DiscoveryTimeStep = dynamic(() => import("./discovery-time-step").then((module) => module.DiscoveryTimeStep), {
  ssr: false,
  loading: () => <Skeleton variant="rect" height={280} />,
});

const STEPS = [{ label: "Your details" }, { label: "Pick a time" }] as const;

/** Fields on step 1: a server error on one of them sends the visitor back there. */
const DETAIL_FIELDS: readonly LeadField[] = ["name", "email", "company", "industry", "country", "package", "message"];

function submit(formData: FormData) {
  const value = (name: string) => String(formData.get(name) ?? "");
  const payload: LeadPayload = {
    name: value("name"),
    email: value("email"),
    company: value("company"),
    industry: value("industry"),
    country: value("country"),
    package: value("package"),
    message: value("message"),
    startsAt: value("startsAt"),
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
  const details = useRef<HTMLDivElement>(null);
  const timeHeading = useRef<HTMLHeadingElement>(null);
  const focusError = useRef(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [country, setCountry] = useState("");
  const [zone, setZone] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [noTimes, setNoTimes] = useState(false);

  // Loaded on choice, not with the page, so the zone table stays off the first-load script.
  async function chooseCountry(value: string) {
    setCountry(value);
    const { timezoneForCountry } = await import("@/content/timezones");
    setZone(timezoneForCountry(value)?.value ?? null);
  }

  function next() {
    // Step 1's own native checks; the server checks everything again on submit.
    const fields = Array.from(details.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea") ?? []);
    const invalid = fields.find((field) => !field.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    setStep(2);
  }

  useEffect(() => {
    if (step === 2) timeHeading.current?.focus();
    if (step === 1 && focusError.current) {
      focusError.current = false;
      details.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [step]);

  const handleTurnstileRender = useCallback((id: string | null) => {
    turnstileId.current = id;
  }, []);
  const handleLoaded = useCallback((count: number) => setNoTimes(count === 0), []);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <Form<LeadField>
      aria-label="Book a discovery call"
      onSubmit={submit}
      onError={(result) => {
        // Turnstile tokens are single-use, so every failed submit needs a fresh one.
        if (turnstileId.current) window.turnstile?.reset(turnstileId.current);
        const errors = result.fieldErrors ?? {};
        if (DETAIL_FIELDS.some((field) => errors[field])) {
          focusError.current = true;
          setStep(1);
        } else if (errors.startsAt) {
          // The picked time was taken or closed meanwhile: show what is open now.
          reload();
        }
      }}
      success={
        <FormSuccess title="Got it — thank you">
          {noTimes
            ? "We've received your details. We'll email you to set up a time for your discovery call."
            : "We've received your discovery call request. It shows as requested until someone on the team confirms the time by email."}
        </FormSuccess>
      }
      className={`${cardSurface} p-6 md:p-8`}
    >
      {({ pending, fieldErrors }) => (
        <>
          <Stepper steps={STEPS} current={step - 1} label="Booking steps" />

          <div ref={details} hidden={step !== 1} className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Full name" name="name" autoComplete="name" required maxLength={LEAD_LIMITS.name} error={fieldErrors.name} />
              <TextField label="Work email" name="email" type="email" autoComplete="email" required maxLength={LEAD_LIMITS.email} error={fieldErrors.email} />
            </div>
            <TextField label="Company" name="company" autoComplete="organization" required maxLength={LEAD_LIMITS.company} error={fieldErrors.company} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Select label="Industry" name="industry" required placeholder="Choose an industry" options={[...INDUSTRIES]} error={fieldErrors.industry} />
              <Select
                label="Country"
                name="country"
                required
                autoComplete="country-name"
                placeholder="Choose a country"
                hint="Call times are shown in this country's time."
                options={[...COUNTRIES]}
                value={country}
                onChange={(event) => chooseCountry(event.target.value)}
                error={fieldErrors.country}
              />
            </div>
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
              hint="The tasks you'd hand off first and when you'd like to start."
              error={fieldErrors.message}
            />

            {/* Honeypot: hidden from people and assistive tech; bots that fill it are silently dropped. */}
            <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
              <label htmlFor="website">Website</label>
              <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <div>
              <Button type="button" size="lg" iconRight="arrow-right" onClick={next}>
                Next: pick a time
              </Button>
            </div>
          </div>

          {step === 2 && (
            <div className="grid gap-5">
              <h2 ref={timeHeading} tabIndex={-1} className="m-0 type-h4 outline-none">
                Pick a time for your 30-minute call
              </h2>
              <DiscoveryTimeStep
                timeZone={zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
                reloadKey={reloadKey}
                onRetry={reload}
                onLoaded={handleLoaded}
                error={fieldErrors.startsAt}
              />

              {TURNSTILE_SITE_KEY && <Turnstile siteKey={TURNSTILE_SITE_KEY} onRender={handleTurnstileRender} />}

              <div className="flex flex-wrap items-center gap-4">
                <Button type="button" variant="ghost" size="lg" iconLeft="chevron-left" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" size="lg" loading={pending}>
                  {pending ? "Sending" : noTimes ? "Send my details" : "Request my discovery call"}
                </Button>
              </div>
              <p className="m-0 type-body-sm text-ink-muted">
                We&apos;ll only use your details to reply. See our <Link href={routes.privacy}>privacy policy</Link>.
              </p>
            </div>
          )}
        </>
      )}
    </Form>
  );
}
