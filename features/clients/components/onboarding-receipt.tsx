import { Card } from "@/components/ui/card";
import type { PublicOnboarding } from "../contract";
import { OnboardingSummary } from "./onboarding-summary";

/** The packet after submit. The same link opens this again; nothing on it can be edited. */
export function OnboardingReceipt({ packet }: { packet: PublicOnboarding }) {
  const business = packet.business;

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="m-0 type-h2">Registration received</h1>
        <p className="m-0 text-ink-muted">You can return to this link any time. The form stays locked while the team reviews it.</p>
      </div>
      <OnboardingSummary packet={packet} />
      <Card as="section" padding="md">
        <h2 className="m-0 type-label">Company</h2>
        <dl className="m-0 mt-4 grid gap-3 sm:grid-cols-2">
          <Item label="Company" value={packet.companyName} />
          <Item label="Industry" value={business.industry} />
          <Item label="City" value={business.city} />
          <Item label="Country" value={business.country} />
          <Item label="Contact" value={packet.contactName} />
          <Item label="Email" value={packet.contactEmail} />
          <Item label="About the business" value={business.about} wide />
        </dl>
      </Card>
      <Card as="section" padding="md" className="grid gap-2">
        <h2 className="m-0 type-label">Consent</h2>
        <p className="m-0 type-body-sm">Signed by {packet.consentName ?? "the contact"}.</p>
      </Card>
      <Card as="section" padding="md" className="grid gap-2">
        <h2 className="m-0 type-label">Payment proof</h2>
        <p className="m-0 type-body-sm">{packet.paymentProofName ?? "Received"}.</p>
      </Card>
    </div>
  );
}

function Item({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="type-caption text-ink-muted">{label}</dt>
      <dd className="m-0 whitespace-pre-line type-body-sm">{value.trim() ? value : "Not provided"}</dd>
    </div>
  );
}
