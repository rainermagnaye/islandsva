// The client agreement shown on the registration link, by version. A published version never changes: the
// acceptance stores the text the customer saw, and a test pins each version's rendered hash. A new wording is a
// new version (v2), and CURRENT_AGREEMENT_VERSION moves to it.
//
// TODO(legal): every version here is a sample pending legal review. Replace it with the reviewed agreement (as v2)
// before launch, and keep the sample notice until then.
//
// Placeholders, filled from the terms the database snapshots (features/clients/agreement.ts): {{company}},
// {{country}}, {{package}}, {{hours}}, {{term}}, {{monthly}}, {{start}}.

export type AgreementSection = { heading: string; paragraphs: readonly string[] };

export type AgreementTemplate = { title: string; sections: readonly AgreementSection[] };

export const AGREEMENTS = {
  v1: {
    title: "Islands VA client agreement (sample)",
    sections: [
      {
        heading: "About this text",
        paragraphs: [
          "This wording is a sample pending legal review. It is not the final agreement. Islands VA will ask you to accept the final wording when it is ready.",
        ],
      },
      {
        heading: "Who this agreement is between",
        paragraphs: ["Islands VA and {{company}} ({{country}}), referred to here as \"you\"."],
      },
      {
        heading: "The service",
        paragraphs: [
          "Islands VA provides virtual assistant support for the package below. The tasks are agreed with you and tracked in your workspace.",
        ],
      },
      {
        heading: "Your package",
        paragraphs: ["Package: {{package}}, {{hours}} hours a week.", "Term: {{term}}.", "Price: {{monthly}} a month.", "Start date: {{start}}."],
      },
      {
        heading: "Billing",
        paragraphs: [
          "You pay for the package as agreed with Islands VA and upload proof of that payment with this registration. The registration is confirmed once the payment has been checked.",
        ],
      },
      {
        heading: "Your obligations",
        paragraphs: [
          "You give accurate details, pay on time, ask only for lawful work, and give your assistant the access the agreed tasks need.",
          "Islands VA handles your information as its Privacy Policy describes.",
        ],
      },
      {
        heading: "Cancellation",
        paragraphs: [
          "Either side may end this agreement in writing. Notice periods and any refunds for each term will be set out in the final agreement.",
        ],
      },
      {
        heading: "Accepting",
        paragraphs: [
          "Typing your name and accepting records your agreement to this text, together with the time, the terms above and the contact email on file.",
        ],
      },
    ],
  },
} as const satisfies Record<string, AgreementTemplate>;

export type AgreementVersion = keyof typeof AGREEMENTS;

export const CURRENT_AGREEMENT_VERSION: AgreementVersion = "v1";
