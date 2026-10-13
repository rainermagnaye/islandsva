import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { appRoutes } from "@/content/routes";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { MfaCodeForm } from "@/features/auth/components/mfa-code-form";
import { MfaSetup } from "@/features/auth/components/mfa-setup";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { listTotpFactors } from "@/features/auth/dal";
import { homeFor } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Two-factor sign-in" };

export default function MfaPage() {
  return (
    <>
      <Suspense>
        <MfaStep />
      </Suspense>
      <SignOutButton />
    </>
  );
}

/** Enter a code if an authenticator is already set up; otherwise set one up. */
async function MfaStep() {
  const user = await requireUser();
  if (user.aal === "aal2") redirect(homeFor(user.roles) ?? appRoutes.dashboard);

  const factor = (await listTotpFactors()).find((f) => f.status === "verified");
  if (factor) {
    return (
      <>
        <AuthHeading title="Enter your code">Open your authenticator app and type the 6-digit code for Islands VA.</AuthHeading>
        <MfaCodeForm factorId={factor.id} submitLabel="Verify and continue" />
      </>
    );
  }
  return (
    <>
      <AuthHeading title="Set up two-factor sign-in">
        Admin accounts can see every client&apos;s details, so they need a code from your phone at each sign-in.
      </AuthHeading>
      <MfaSetup />
    </>
  );
}
