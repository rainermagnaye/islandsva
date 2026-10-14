"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { TextField } from "@/components/ui/text-field";
import { signIn } from "../actions";
import { LINK_ERRORS, PASSWORD_RULES, type LinkError, type SignInField } from "../contract";

/** Reads ?next= (where to return after sign-in) and ?error= (a failed email link) from the URL. */
export function LoginFormWithParams({ forgotPasswordLink }: { forgotPasswordLink: ReactNode }) {
  const params = useSearchParams();
  const error = params.get("error");
  return (
    <LoginForm
      forgotPasswordLink={forgotPasswordLink}
      next={params.get("next") ?? undefined}
      linkError={error && error in LINK_ERRORS ? (error as LinkError) : undefined}
    />
  );
}

export function LoginForm({
  next,
  linkError,
  forgotPasswordLink,
}: {
  next?: string;
  linkError?: LinkError;
  forgotPasswordLink: ReactNode;
}) {
  return (
    <div className="grid gap-5">
      {linkError && (
        <p role="alert" className="m-0 flex items-start gap-2 rounded-md bg-status-warning-bg p-4 type-label text-status-warning">
          <Icon name="alert" className="mt-0.5" />
          {LINK_ERRORS[linkError]}
        </p>
      )}
      <Form<SignInField> aria-label="Sign in" onSubmit={signIn}>
        {({ pending, fieldErrors }) => (
          <>
            {/* Validated on the server: only same-site paths are honoured. */}
            {next && <input type="hidden" name="next" value={next} />}
            <TextField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} error={fieldErrors.email} />
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={PASSWORD_RULES.max}
              error={fieldErrors.password}
            />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Button type="submit" loading={pending}>
                {pending ? "Signing in" : "Sign in"}
              </Button>
              {forgotPasswordLink}
            </div>
          </>
        )}
      </Form>
    </div>
  );
}
