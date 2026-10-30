import "server-only";
import { z } from "zod";
import { CURRENT_AGREEMENT_VERSION } from "@/content/agreement";
import { FORM_ERROR, NO_CONTROL_CHARS, parseWith, tooLong } from "@/lib/validation";
import { SIGNER_NAME_LIMIT, type AgreementAcceptanceField, type ClientBusiness, type PaymentProofStepField } from "./contract";
import { acceptPaymentProof } from "./payment-proof";
import { CLIENT_DETAIL_FIELDS, registrationDetailsShape, registrationToken } from "./validation";

// The registration link's three steps, each saved on its own: details, agreement, payment proof.

const detailsSchema = z
  .strictObject(registrationDetailsShape)
  .transform(({ token, contactPhone, companyName, contactName, ...business }) => ({
    token,
    companyName,
    contactName,
    contactPhone: contactPhone || null,
    business: business satisfies ClientBusiness,
  }));

export type RegistrationDetailsInput = z.output<typeof detailsSchema>;

/** Step 1: the company details, with the same rules as the one-page form. */
export const parseRegistrationDetails = (input: unknown) => parseWith(detailsSchema, input, CLIENT_DETAIL_FIELDS);

export const AGREEMENT_CHANGED = "The agreement changed. Read it again before you accept.";

const agreementSchema = z.strictObject({
  token: registrationToken,
  version: z.string({ error: FORM_ERROR }).max(8, FORM_ERROR),
  // SHA-256 of the text the page showed; the server compares it with its own render.
  fingerprint: z.string({ error: FORM_ERROR }).regex(/^[0-9a-f]{64}$/, FORM_ERROR),
  signerName: z
    .string({ error: "Type your full name to sign." })
    .trim()
    .min(1, "Type your full name to sign.")
    .max(SIGNER_NAME_LIMIT, tooLong("your name", SIGNER_NAME_LIMIT))
    .regex(NO_CONTROL_CHARS, "Remove any unusual characters from your name."),
  accept: z.literal("yes", { error: "Confirm you accept the agreement to continue." }),
});

export type AgreementAcceptanceInput = Omit<z.output<typeof agreementSchema>, "accept">;

/** Step 2: accepting the agreement. A version other than the current one is a stale page: read it again. */
export function parseAgreementAcceptance(input: unknown) {
  const parsed = parseWith<typeof agreementSchema, AgreementAcceptanceField>(agreementSchema, input, ["signerName", "accept"]);
  if (!parsed.ok) return parsed;
  if (parsed.value.version !== CURRENT_AGREEMENT_VERSION) return { ok: false as const, formError: AGREEMENT_CHANGED };
  const { token, version, fingerprint, signerName } = parsed.value;
  return { ok: true as const, value: { token, version, fingerprint, signerName } satisfies AgreementAcceptanceInput };
}

const PROOF_REQUIRED = "Upload proof of payment to continue.";

const proofSchema = z
  .strictObject({
    token: registrationToken,
    proof: z.instanceof(File, { error: PROOF_REQUIRED }).refine((file) => file.size > 0 || file.name !== "", PROOF_REQUIRED),
  })
  .transform(({ token, proof }, ctx) => {
    const accepted = acceptPaymentProof(proof);
    if (!accepted.ok) {
      ctx.addIssue({ code: "custom", path: ["proof"], message: accepted.message });
      return z.NEVER;
    }
    return { token, file: proof, name: accepted.name, type: accepted.type };
  });

export type PaymentProofStepInput = z.output<typeof proofSchema>;

/** Step 3: the payment proof, with the one-page form's checks (2 MB; PDF, JPG, PNG or WebP). */
export const parsePaymentProofStep = (input: unknown) => parseWith<typeof proofSchema, PaymentProofStepField>(proofSchema, input, ["proof"]);
