import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice, packages, terms } from "@/content/packages";
import { OnboardingForm } from "@/features/clients/components/onboarding-form";
import { isOnboardingToken } from "@/features/clients/onboarding-validation";
import { loadInvitation } from "@/features/clients/service";

export const metadata: Metadata = { title: "Your onboarding form" };

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

export default function OnboardingPage({ params }: PageProps<"/onboarding/[token]">) {
  return (
    <Suspense fallback={<Card padding="md" className="min-h-64" aria-busy="true" />}>
      <Onboarding params={params} />
    </Suspense>
  );
}

async function Onboarding({ params }: Pick<PageProps<"/onboarding/[token]">, "params">) {
  const { token } = await params;
  // A mangled token never reaches the database.
  if (!isOnboardingToken(token)) notFound();
  const found = await loadInvitation(token);
  if (found.state === "unknown") notFound();
  if (found.state === "gone") {
    return (
      <Card padding="md">
        <EmptyState title="This link has already been used or has expired" description="If you still need to send your details, ask your Islands VA contact for a new link." />
      </Card>
    );
  }

  const { invitation } = found;
  const pkg = packages.find((item) => item.slug === invitation.packageCode);
  const term = terms.find((item) => item.months === invitation.termMonths);
  const summary =
    pkg && term && invitation.monthlyCents
      ? `${pkg.name}, ${pkg.hoursPerWeek}, ${term.label.toLowerCase()} at ${formatPrice(invitation.monthlyCents)} a month${invitation.startsOn ? `, starting ${day.format(new Date(invitation.startsOn))}` : ""}.`
      : null;

  return (
    <div className="grid gap-6">
      <div className="grid gap-2 text-center">
        <h1 className="m-0 type-h1">Welcome, {invitation.contactName.split(" ")[0]}</h1>
        <p className="m-0 text-ink-muted">
          A few details to set up {invitation.companyName}. This link works once and expires on {day.format(new Date(invitation.expiresAt))}.
        </p>
      </div>
      <OnboardingForm token={token} invitation={invitation} packageSummary={summary} />
    </div>
  );
}
