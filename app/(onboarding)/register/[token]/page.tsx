import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { appRoutes } from "@/content/routes";
import { agreementMissingTerms } from "@/features/clients/agreement";
import { OnboardingReceipt } from "@/features/clients/components/onboarding-receipt";
import { RegistrationSteps } from "@/features/clients/components/registration-steps";
import { getPublicOnboarding } from "@/features/clients/onboarding-dal";
import { openRegistrationSteps, registrationView } from "@/features/clients/registration";
import { getRegistrationState } from "@/features/clients/registration-dal";

export const metadata: Metadata = { title: "Registration" };

export default function RegistrationPage({ params }: PageProps<"/register/[token]">) {
  return (
    <Suspense fallback={<p className="m-0 type-body text-ink-muted">Loading registration…</p>}>
      <Registration params={params} />
    </Suspense>
  );
}

async function Registration({ params }: Pick<PageProps<"/register/[token]">, "params">) {
  const { token } = await params;
  const state = await getRegistrationState(token);
  if (!state) notFound();
  const open = state.editable
    ? openRegistrationSteps({
        companyName: state.companyName,
        contactName: state.contactName,
        business: state.business,
        reviewIssues: state.reviewIssues,
        agreementCurrent: state.agreementCurrent,
        termsMissing: agreementMissingTerms(state.terms),
        hasProof: Boolean(state.paymentProofName),
      })
    : [];
  const view = registrationView({ accountStatus: state.accountStatus, onboardingStatus: state.onboardingStatus, disabledAt: state.disabledAt, openSteps: open.length });

  if (view === "steps") return <RegistrationSteps token={token} state={state} open={open} />;
  if (view === "receipt") {
    const packet = await getPublicOnboarding(token);
    if (!packet) notFound();
    return <OnboardingReceipt packet={packet} />;
  }
  if (view === "closed") {
    return <Notice title="Registration closed">This registration is no longer open. Contact the team if you still need to finish it.</Notice>;
  }
  if (view === "complete") {
    return (
      <Notice title="Registration complete">
        Sign in to your workspace. <Link href={appRoutes.login}>Go to sign in</Link>
      </Notice>
    );
  }
  return <Notice title="Registration received">We&apos;re sending it to the team. Refresh this page in a moment.</Notice>;
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card padding="md" className="grid gap-2">
      <h1 className="m-0 type-h2">{title}</h1>
      <p className="m-0 text-ink-muted">{children}</p>
    </Card>
  );
}
