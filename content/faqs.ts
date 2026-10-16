import { industries } from "./brands";
import { formatPrice, packages, startingPrice } from "./packages";
import { services } from "./services";

export type Faq = { question: string; answer: string };

function list(items: readonly string[]) {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** Percent saved versus month-to-month, from the same prices the pricing page shows. */
function savedPercent(months: 6 | 12) {
  const pkg = packages[0];
  return Math.round((1 - pkg.monthlyPrice[months] / pkg.monthlyPrice[1]) * 100);
}

function priceAnswer() {
  const lines = packages.map(
    (pkg) =>
      `${pkg.name} is ${formatPrice(startingPrice(pkg))} a month on a 12-month term, or ${formatPrice(pkg.monthlyPrice[1])} month to month`,
  );
  return `${lines.join(". ")}. A 6-month term saves ${savedPercent(6)}%.`;
}

const workAnswer = `The day-to-day work that lives on a computer: ${list(services.map((service) => service.title.toLowerCase()))}. If you're unsure a task fits, ask us on your discovery call.`;

const fitAnswer = "Tell us. We'll talk through what isn't working and, if needed, match you with a different assistant.";

const whoAnswer = `Founders, operations leads and small teams who want inbox, calendar and customer work taken off their plate. Assistants support ${list(industries.map((industry) => industry.title.toLowerCase()))}.`;

/** The five customer questions for the home page. */
export const homeFaqs: Faq[] = [
  { question: "Who do you work with?", answer: whoAnswer },
  { question: "What kind of work can a VA do?", answer: workAnswer },
  {
    question: "How quickly can I get a VA?",
    answer: "After your discovery call we match you with a VA and start onboarding. Most clients are working with their assistant within a week or two.",
  },
  { question: "How much does it cost?", answer: priceAnswer() },
  { question: "What if my VA isn't the right fit?", answer: fitAnswer },
];

export const packageFaqs: Faq[] = [
  {
    question: "What's the difference between the packages?",
    answer: packages
      .map((pkg) => `${pkg.name} is ${pkg.hoursPerWeek.toLowerCase()}. ${pkg.tagline}`)
      .join(" "),
  },
  {
    question: "Do I get my own assistant?",
    answer: "Yes. Every package includes a dedicated, vetted VA, not a shared pool. Day and night includes two assistants, one on each shift.",
  },
  {
    question: "What does full-time and part-time mean?",
    answer: "Essentials is 20 hours a week with one part-time VA. Executive is 40 hours a week with one full-time VA. Day and night is 80 hours a week, with two VAs covering day and night.",
  },
  {
    question: "Can I change packages later?",
    answer: "Yes. You can change packages as what you need changes.",
  },
  {
    question: "What if I'm not sure which package I need?",
    answer: "Book a free discovery call and leave the package as \"Not sure yet\". We'll recommend one after we learn how you work.",
  },
];

export const pricingFaqs: Faq[] = [
  { question: "How much does it cost?", answer: priceAnswer() },
  {
    question: "Why is the 12-month price lower?",
    answer: `A longer term costs less each month. A 6-month term saves ${savedPercent(6)}% and a 12-month term saves ${savedPercent(12)}%, compared with paying month to month. The "from" price on each package is the 12-month price.`,
  },
  {
    question: "Can I pay month to month?",
    answer: "Yes. You can pay month to month, or commit to 6 or 12 months for a lower monthly price.",
  },
  {
    question: "What am I paying for?",
    answer: "One monthly price for the package you choose: a dedicated assistant and the work listed for that package. The pricing table is the full comparison.",
  },
  {
    question: "Do I have to sign a long contract?",
    answer: "No. Month to month is available. A 6- or 12-month term is only there if you want the lower monthly price.",
  },
];

export const aboutFaqs: Faq[] = [
  {
    question: "Where are your virtual assistants based?",
    answer:
      "In the Philippines. They're fluent in English, experienced with international clients, and can work your business hours — or nights, if that's when you need them.",
  },
  {
    question: "How do you choose an assistant?",
    answer:
      "Every assistant goes through a skills and English assessment, then interviews and reference checks. We match them with clients whose work fits their strengths.",
  },
  {
    question: "Do you stay involved after we start?",
    answer: "Yes. We stay in touch with regular check-ins, and you can come to us whenever you need help with the partnership.",
  },
  { question: "Who do you work with?", answer: whoAnswer },
  {
    question: "How do you keep my information secure?",
    answer:
      "Your VA only gets access to the tools they need, through accounts you control. We recommend a password manager and never ask for your personal passwords.",
  },
  {
    question: "Can my VA cover nights?",
    answer: "Yes. You can choose daytime cover, overnight cover, or both. Day and night puts two assistants on shifts so work doesn't wait until morning.",
  },
];

export const brandFaqs: Faq[] = [
  {
    question: "What kinds of businesses do you support?",
    answer: `Assistants support ${list(industries.map((industry) => industry.title.toLowerCase()))}.`,
  },
  {
    question: "Do we have to be in one of those industries?",
    answer: "No. If the work is inbox, calendar, customers or admin, tell us on a discovery call and we'll say whether it's a fit.",
  },
  {
    question: "Will a VA learn the tools we already use?",
    answer: "Yes. During onboarding your VA learns your tools and the way you already work, so the handoff feels familiar.",
  },
  {
    question: "What if our work is a bit unusual?",
    answer: "Ask us on the discovery call. We'll tell you honestly whether a VA can take it on.",
  },
];

export const testimonialFaqs: Faq[] = [
  {
    question: "What do clients usually hand off first?",
    answer: "Inbox, calendar and follow-ups. Those are the tasks that fill the day before anyone gets to the work only they can do.",
  },
  {
    question: "How will I know it's working?",
    answer: "You get regular check-ins with your VA, and a weekly summary of what got done, so you can see the work without chasing it.",
  },
  { question: "What if my VA isn't the right fit?", answer: fitAnswer },
  {
    question: "How do I get started?",
    answer: "Book a free discovery call. We'll learn how you work and recommend a package. There's no cost and no commitment.",
  },
];

export const contactFaqs: Faq[] = [
  { question: "Is the discovery call free?", answer: "Yes. There's no cost and no commitment." },
  {
    question: "How long is the call?",
    answer: "About 30 minutes. We learn how you work and what you'd like to hand off, then recommend a package.",
  },
  { question: "How soon will you reply?", answer: "Within one business day, to book the call." },
  {
    question: "Do I need to choose a package first?",
    answer: "No. Leave the package as \"Not sure yet\" and we'll recommend one on the call.",
  },
  {
    question: "What should I tell you on the form?",
    answer: "What you'd like to hand off, and a package if you already know which one. If you don't, choose \"Not sure yet\".",
  },
  {
    question: "Where is your team based?",
    answer: "In the Philippines. The team covers day and night shifts.",
  },
];

export const privacyFaqs: Faq[] = [
  {
    question: "What do you collect when I contact you?",
    answer: "Your name, email address, company, industry, country and message. We use them to reply and, if you become a client, to provide the service.",
  },
  {
    question: "Do you sell my information?",
    answer: "No. We don't sell your information or use it for third-party advertising.",
  },
  {
    question: "Do you use tracking cookies?",
    answer: "No. We don't use cookies for advertising or tracking. The site's light or dark look follows your browser's setting.",
  },
  {
    question: "How long do you keep an enquiry?",
    answer: "If an enquiry doesn't become a client relationship, we keep it for up to 24 months, then delete or anonymise it.",
  },
  {
    question: "Can I ask you to delete my information?",
    answer: "Yes. You can ask to see, correct or delete the personal information we hold, or object to how we use it, through the contact page.",
  },
];

export const termsFaqs: Faq[] = [
  {
    question: "Do these terms cover my assistant?",
    answer: "These terms cover use of the website. If you become a client, your service agreement sets out the terms of the services we provide.",
  },
  {
    question: "Can the prices on the site change?",
    answer: "Yes. Packages, prices and availability on the site may change. Your service agreement is what applies to services we provide.",
  },
  {
    question: "Can I reuse the Islands VA name or logo?",
    answer: "No. The name, logo and site content belong to us. You need written permission to reuse them.",
  },
  {
    question: "How do I ask about these terms?",
    answer: "Get in touch through the contact page.",
  },
];
