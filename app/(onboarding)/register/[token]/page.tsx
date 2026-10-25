import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { OnboardingForm } from "@/features/clients/components/onboarding-form";
import { OnboardingReceipt } from "@/features/clients/components/onboarding-receipt";
import { getPublicOnboarding } from "@/features/clients/onboarding-dal";

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
  const packet = await getPublicOnboarding(token);
  if (!packet) notFound();
  if (packet.closed) {
    return (
      <Card padding="md" className="grid gap-2">
        <h1 className="m-0 type-h2">Registration closed</h1>
        <p className="m-0 text-ink-muted">This registration is no longer open. Contact the team if you still need to finish it.</p>
      </Card>
    );
  }
  if (!packet.editable) return <OnboardingReceipt packet={packet} />;
  return <OnboardingForm token={token} packet={packet} />;
}
