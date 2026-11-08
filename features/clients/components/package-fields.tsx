"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { formatPrice, packages, terms } from "@/content/packages";
import { PACKAGE_TIMEZONES } from "@/features/leads/contract";
import type { ClientPackageField, ClientPackageValues } from "../contract";

export type PackageField = ClientPackageField;

const HOUR_OPTIONS = packages.map((item) => ({ value: String(item.weeklyHours), label: item.hoursPerWeek }));
const TERM_OPTIONS = terms.map((term) => ({
  value: String(term.months),
  label: term.months === 1 ? term.label : `${term.label} (${term.note})`,
}));
const TIMEZONE_OPTIONS = PACKAGE_TIMEZONES.map((zone) => ({ value: zone.value, label: zone.label }));

function isoDay(offset: number) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The agreed package: package and hours move together, then term, start date and time zone. The price shown
 * is the catalogue price for that term; the server reads it again from the catalogue, never from the form.
 * `current` starts the fields from a client's package (the change-package form); `initialSlug` only picks the package.
 */
export function PackageFields({
  initialSlug,
  current,
  fieldErrors,
}: {
  initialSlug?: string | null;
  current?: ClientPackageValues;
  fieldErrors: Partial<Record<PackageField, string>>;
}) {
  const initial = packages.find((item) => item.slug === (current?.packageCode ?? initialSlug));
  const [packageSlug, setPackageSlug] = useState(initial?.slug ?? "");
  const [hours, setHours] = useState(initial ? String(initial.weeklyHours) : "");
  const [termMonths, setTermMonths] = useState(current?.termMonths ? String(current.termMonths) : "1");
  const knownZone = TIMEZONE_OPTIONS.some((zone) => zone.value === current?.timezone);
  const chosen = packages.find((item) => item.slug === packageSlug);
  const term = terms.find((item) => String(item.months) === termMonths);
  const price = chosen && term ? formatPrice(chosen.monthlyPrice[term.months]) : null;

  function choosePackage(slug: string) {
    setPackageSlug(slug);
    const next = packages.find((item) => item.slug === slug);
    if (next) setHours(String(next.weeklyHours));
  }

  function chooseHours(value: string) {
    setHours(value);
    const next = packages.find((item) => String(item.weeklyHours) === value);
    if (next) setPackageSlug(next.slug);
  }

  return (
    <>
      <Select
        label="Package"
        name="package"
        required
        placeholder="Choose a package"
        options={packages.map((item) => ({ value: item.slug, label: item.name }))}
        value={packageSlug}
        onChange={(event) => choosePackage(event.target.value)}
        error={fieldErrors.package}
      />
      <Select label="Hours" name="hoursPerWeek" required placeholder="Choose the hours" options={HOUR_OPTIONS} value={hours} onChange={(event) => chooseHours(event.target.value)} error={fieldErrors.hoursPerWeek} />
      <Select label="Term" name="termMonths" required options={TERM_OPTIONS} value={termMonths} onChange={(event) => setTermMonths(event.target.value)} error={fieldErrors.termMonths} />
      <p className="m-0 rounded-md bg-surface-sunken px-3.5 py-3 type-body-sm text-ink">
        {chosen && term && price ? `${chosen.name}, ${chosen.hoursPerWeek}, ${term.label.toLowerCase()} at ${price} a month.` : "Choose a package to confirm the monthly price."}
      </p>
      <TextField
        label="Start date"
        name="startsOn"
        type="date"
        required
        min={isoDay(0)}
        max={isoDay(366)}
        // A start that has already passed isn't offered again: they pick a new one.
        defaultValue={current?.startsOn && current.startsOn.slice(0, 10) >= isoDay(0) ? current.startsOn.slice(0, 10) : undefined}
        hint="The first day their coverage begins."
        error={fieldErrors.startsOn}
      />
      <Select
        label="Time zone"
        name="timezone"
        required
        placeholder="Choose their time zone"
        options={TIMEZONE_OPTIONS}
        // Only when known: an explicit undefined would override Select's placeholder default and preselect the first zone.
        {...(knownZone && current?.timezone ? { defaultValue: current.timezone } : {})}
        error={fieldErrors.timezone}
      />
    </>
  );
}
