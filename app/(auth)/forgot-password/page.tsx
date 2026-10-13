import type { Metadata } from "next";
import Link from "next/link";
import { appRoutes } from "@/content/routes";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title="Reset your password">Enter your email and we&apos;ll send you a link to choose a new one.</AuthHeading>
      <ForgotPasswordForm />
      <Link href={appRoutes.login} className="type-body-sm">
        Back to sign in
      </Link>
    </>
  );
}
