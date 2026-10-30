import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Stepper } from "@/components/ui/stepper";
import { agreementMissingTerms } from "../agreement";
import type { RegistrationState } from "../registration-dal";
import { REGISTRATION_STEPS, REGISTRATION_STEP_LABELS, stepRevisionMessage, type RegistrationStep } from "../registration";
import { currentAgreement } from "../service";
import { AgreementStep } from "./agreement-step";
import { DetailsStep } from "./details-step";
import { OnboardingSummary } from "./onboarding-summary";
import { PaymentStep } from "./payment-step";

const STEPS = REGISTRATION_STEPS.map((step) => ({ label: REGISTRATION_STEP_LABELS[step] }));

/**
 * The registration link while it's with the customer: the stepper and the first open step only. The server chooses
 * the step (openRegistrationSteps); each save re-renders this on the next one.
 */
export function RegistrationSteps({ token, state, open }: { token: string; state: RegistrationState; open: readonly RegistrationStep[] }) {
  const step = open[0];
  const last = open.length === 1;
  const note = stepRevisionMessage(state.reviewIssues, state.reviewNote);
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="m-0 type-h2">Company registration</h1>
        <p className="m-0 max-w-[60ch] text-ink-muted">Three short steps. Your answers are saved as you go, and you can return to this link any time.</p>
      </div>
      <Stepper steps={STEPS} current={REGISTRATION_STEPS.indexOf(step)} label="Registration steps" />
      {state.onboardingStatus === "changes_requested" && note && (
        <Alert tone="warning" title="A few details need a change">
          {note}
        </Alert>
      )}
      {step === "details" && (
        <DetailsStep
          token={token}
          companyName={state.companyName}
          contactName={state.contactName}
          contactEmail={state.contactEmail}
          contactPhone={state.contactPhone}
          business={state.business}
          last={last}
        />
      )}
      {step === "agreement" && <Agreement token={token} state={state} last={last} />}
      {step === "payment" && (
        <PaymentStep token={token} currentProof={state.paymentProofName} last={last}>
          <OnboardingSummary
            packet={{ packageCode: state.terms.package_code, termMonths: state.terms.term_months, monthlyCents: state.terms.monthly_cents, startsOn: state.terms.starts_on, business: state.business }}
          />
        </PaymentStep>
      )}
    </div>
  );
}

function Agreement({ token, state, last }: { token: string; state: RegistrationState; last: boolean }) {
  if (agreementMissingTerms(state.terms)) {
    return (
      <Alert tone="info" title="Your package isn't set up yet">
        Contact your account manager. You can come back to this link once it&apos;s ready.
      </Alert>
    );
  }
  const agreement = currentAgreement(state.terms);
  const [title, ...sections] = agreement.text.split("\n\n");
  return (
    <AgreementStep token={token} version={agreement.version} fingerprint={agreement.fingerprint} last={last}>
      <Card as="article" padding="md" className="grid max-h-[32rem] gap-4 overflow-y-auto" tabIndex={0} aria-label="Agreement text">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 type-h3">{title}</h2>
          {/* TODO(legal): the wording is a sample until the reviewed agreement replaces it. */}
          <Badge tone="warning" size="sm" icon={null}>
            Sample
          </Badge>
        </div>
        {sections.map((section) => {
          const [heading, ...paragraphs] = section.split("\n");
          return (
            <section key={heading} className="grid gap-1">
              <h3 className="m-0 type-label">{heading}</h3>
              {paragraphs.map((paragraph) => (
                <p key={paragraph} className="m-0 type-body-sm">
                  {paragraph}
                </p>
              ))}
            </section>
          );
        })}
      </Card>
    </AgreementStep>
  );
}
