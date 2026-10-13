import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { LoginForm, LoginFormWithParams } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <AuthHeading title="Sign in">Clients, VAs and the Islands VA team sign in here.</AuthHeading>
      {/* The static form renders instantly; ?next= and ?error= hydrate in from the URL. */}
      <Suspense fallback={<LoginForm />}>
        <LoginFormWithParams />
      </Suspense>
    </>
  );
}
