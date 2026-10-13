import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a password" };

// Reached from an invite or reset email: /auth/confirm has just signed the user in.
export default function SetPasswordPage() {
  return (
    <>
      <AuthHeading title="Choose a password">You&apos;ll use it with your email to sign in.</AuthHeading>
      <Suspense>
        <SignedInOnly />
      </Suspense>
    </>
  );
}

async function SignedInOnly() {
  await requireUser();
  return <SetPasswordForm />;
}
