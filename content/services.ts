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
