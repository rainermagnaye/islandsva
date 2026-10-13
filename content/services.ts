import type { IconName } from "@/types/icon";

export const services: { icon: IconName; title: string; description: string }[] = [
  { icon: "inbox", title: "Inbox management", description: "Triage, replies and follow-ups, so you open a clear inbox every morning." },
  { icon: "calendar", title: "Calendar and scheduling", description: "Meetings booked, rescheduled and confirmed across every time zone." },
  { icon: "message", title: "Customer support", description: "Friendly, on-brand replies by email and chat, including after hours." },
  { icon: "file", title: "Admin and data entry", description: "Documents, spreadsheets, CRM updates and the busywork that piles up." },
  { icon: "search", title: "Research", description: "Leads, vendors, travel options and market research, summarised for you." },
  { icon: "chart", title: "Reporting", description: "Weekly summaries of what got done, so you always know where things stand." },
];

export const steps: { title: string; description: string }[] = [
  { title: "Book a discovery call", description: "Tell us what's taking your time. We'll recommend a package that fits." },
  { title: "Meet your VA", description: "We match you with a vetted assistant whose skills fit your work." },
  { title: "Get set up", description: "We onboard your VA to your tools and routines in the first week." },
  { title: "Hand it off", description: "Your VA takes over, with regular check-ins and a team behind them." },
];

export const faqs: { question: string; answer: string }[] = [
  {
    question: "Where are your virtual assistants based?",
    answer:
      "Our assistants are based in the Philippines. They're fluent in English, experienced with international clients and work your business hours — or nights, if that's when you need them.",
  },
  {
    question: "How quickly can I get started?",
    answer:
      "After your discovery call we match you with a VA and start onboarding. Most clients are working with their assistant within a week or two.",
  },
  {
    question: "What if my VA isn't the right fit?",
    answer: "Tell us. We'll talk through what isn't working and, if needed, match you with a different assistant.",
  },
  {
    question: "Do I have to sign a long contract?",
    answer: "No. You can pay month to month, or commit to 6 or 12 months for a lower monthly price.",
  },
  {
    question: "How do you keep my information secure?",
    answer:
      "Your VA only gets access to the tools they need, through accounts you control. We recommend a password manager and never ask for your personal passwords.",
  },
];
