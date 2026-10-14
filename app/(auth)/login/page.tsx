import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { appRoutes } from "@/content/routes";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { LoginForm, LoginFormWithParams } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  // Built on the server. The client form must not import the route map: during
  // instant validation that import is missing and the link crashes the page.
  const forgotPasswordLink = (
    <Link href={appRoutes.forgotPassword} className="type-body-sm">
      Forgot your password?
    </Link>
  );
  return (
    <>
      <AuthHeading title="Sign in">Clients, VAs and the Islands VA team sign in here.</AuthHeading>
      {/* The static form renders instantly; ?next= and ?error= hydrate in from the URL. */}
      <Suspense fallback={<LoginForm forgotPasswordLink={forgotPasswordLink} />}>
        <LoginFormWithParams forgotPasswordLink={forgotPasswordLink} />
      </Suspense>
    </>
  );
}
