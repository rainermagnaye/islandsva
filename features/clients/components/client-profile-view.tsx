import type { ReactNode } from "react";
import { AttachmentPreview } from "@/components/ui/attachment-preview";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { formatPackagePrice } from "@/content/currencies";
import { packages, terms } from "@/content/packages";
import { adminClientPaymentHref } from "@/content/routes";
import { timezoneForCountry } from "@/content/timezones";
import { CLIENT_STATUS_LABELS, type ClientDetail, type ClientRegistrationStep, type ClientStatus } from "../contract";

const TONES: Record<ClientStatus, BadgeTone> = { pending: "warning", active: "success", inactive: "neutral" };

/** Disabled wins over the onboarding status, so a hidden client never reads as active. */
export function ClientStatusBadge({ status, disabledAt }: { status: ClientStatus; disabledAt: string | null }) {
  if (disabledAt) {
    return (
      <Badge tone="neutral" size="sm" dot>
        Disabled
      </Badge>
    );
  }
  return (
    <Badge tone={TONES[status]} dot={status === "inactive"}>
      {CLIENT_STATUS_LABELS[status]}
    </Badge>
  );
}

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export function ClientStepper({ steps }: { steps: readonly ClientRegistrationStep[] }) {
  return (
    <Card as="section" padding="sm" className="flex flex-wrap items-center justify-center">
      <ol className="m-0 flex list-none flex-wrap justify-center gap-y-2 p-0" aria-label="Registration progress">
        {steps.map((step, index) => (
          <li key={step.id} className="flex min-w-0 items-center">
            <span
              className={
                step.done
                  ? "grid size-7 place-items-center rounded-pill bg-status-success-bg text-status-success"
                  : step.current
                    ? "grid size-7 place-items-center rounded-pill bg-action-primary text-on-action-primary type-label"
                    : "grid size-7 place-items-center rounded-pill bg-surface-sunken text-ink-muted type-label"
              }
            >
              {step.done ? <Icon name="check" size={16} /> : index + 1}
              <span className="sr-only">{step.done ? "Complete" : step.current ? "Current step" : "Not started"}</span>
            </span>
            <span className={`px-2 type-label ${step.current ? "text-ink" : "text-ink-muted"}`} aria-current={step.current ? "step" : undefined}>
              {step.label}
            </span>
            {index < steps.length - 1 && <span className="mr-2 h-px w-4 bg-border" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Basic info, address, contacts, and the agreed package. */
export function ClientProfileView({ client }: { client: ClientDetail }) {
  const business = client.business;
  const pkg = packages.find((item) => item.slug === client.packageCode);
  const term = terms.find((item) => item.months === client.termMonths);
  const zone = timezoneForCountry(business.country)?.label ?? null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="grid gap-4">
        <DetailsCard title="Basic info">
          <Field label="Company" value={client.companyName} />
          <Field label="Industry" value={business.industry} />
          <Field label="Website" value={business.website} />
          <Field label="Team size" value={business.staffCount} />
          <Field label="About the business" value={business.about} wide />
        </DetailsCard>
        <DetailsCard title="Address">
          <Field label="Street" value={business.street} wide />
          <Field label="City" value={business.city} />
          <Field label="State" value={business.state} />
          <Field label="Zip code" value={business.zip} />
          <Field label="Country" value={business.country} />
        </DetailsCard>
      </div>
      <div className="grid content-start gap-4">
        <DetailsCard title="Contacts">
          <Field label="Contact" value={client.contactName} />
          <Field label="Job title" value={business.jobTitle} />
          <Field label="Email" value={client.contactEmail} />
          <Field label="Phone" value={client.contactPhone} />
        </DetailsCard>
        <DetailsCard title="Package">
          <Field label="Package" value={pkg?.name ?? null} />
          <Field label="Hours" value={pkg?.hoursPerWeek ?? null} />
          <Field label="Term" value={term?.label ?? null} />
          <Field label="Monthly price" value={client.monthlyCents ? formatPackagePrice(client.monthlyCents, business.country) : null} />
          <Field label="Start date" value={client.startsOn ? day.format(new Date(`${client.startsOn.slice(0, 10)}T00:00:00Z`)) : null} />
          <Field label="Time zone" value={zone} />
        </DetailsCard>
      </div>
    </div>
  );
}

const signed = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** The consent signed on the registration link. */
export function ClientConsents({ consent }: { consent: { name: string; signedAt: string | null } | null }) {
  if (!consent) return <EmptyState compact title="No consents yet" description="A signed consent appears here once the customer submits their registration." />;
  return (
    <Card as="section" padding="md" className="grid gap-2">
      <h2 className="m-0 type-label">Registration consent</h2>
      <p className="m-0 type-body-sm">Signed by {consent.name}{consent.signedAt ? ` on ${signed.format(new Date(consent.signedAt))}` : ""}.</p>
    </Card>
  );
}

/** Payment proof uploaded with the registration. Invoices themselves come later. */
export function ClientInvoices({
  clientId,
  proofName,
  proofType,
  amount,
  country,
}: {
  clientId: string;
  proofName: string | null;
  proofType: string | null;
  amount: number | null;
  country?: string;
}) {
  if (!proofName) return <EmptyState compact title="No invoices yet" description="Payment proof appears here once the customer submits their registration." />;
  return (
    <Card as="section" padding="md" className="grid gap-2">
      <h2 className="m-0 type-label">Payment proof</h2>
      {amount ? <p className="m-0 type-body-sm">{formatPackagePrice(amount, country ?? "")} a month.</p> : null}
      <AttachmentPreview href={adminClientPaymentHref(clientId)} name={proofName} type={proofType ?? typeFromName(proofName)} />
    </Card>
  );
}

function typeFromName(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function DetailsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section" padding="none">
      <h2 className="m-0 border-b border-border px-4 py-3 type-label">{title}</h2>
      <dl className="m-0 grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">{children}</dl>
    </Card>
  );
}

function Field({ label, value, wide = false }: { label: string; value: string | null; wide?: boolean }) {
  const shown = value?.trim() ? value : "Not provided";
  return (
    <div className={wide ? "min-w-0 sm:col-span-2" : "min-w-0"}>
      <dt className="type-caption text-ink-muted">{label}</dt>
      <dd className={`m-0 whitespace-pre-line type-body-sm ${shown === "Not provided" ? "text-ink-muted" : "text-ink"}`}>{shown}</dd>
    </div>
  );
}
