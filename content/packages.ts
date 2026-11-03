import type { IconName } from "@/types/icon";

export type SubscriptionTerm = 1 | 6 | 12; // months

export type Package = {
  /** Stable id — becomes the DB primary key / payment product mapping in M4. */
  id: string;
  slug: string;
  name: string;
  icon: IconName;
  tagline: string;
  /** Hours the package includes. `hoursPerWeek` is the same number, written out. */
  weeklyHours: 20 | 40 | 80;
  hoursPerWeek: string;
  bestFor: string;
  features: string[];
  /** Monthly price in minor units (US cents) for each commitment term. */
  monthlyPrice: Record<SubscriptionTerm, number>;
  currency: "USD";
  featured?: boolean;
};

export const terms: { months: SubscriptionTerm; label: string; note: string }[] = [
  { months: 1, label: "Monthly", note: "Billed monthly" },
  { months: 6, label: "6 months", note: "Save 5%" },
  { months: 12, label: "12 months", note: "Save 10%" },
];

// TODO(content): confirm package names, inclusions and prices before launch.
export const packages: Package[] = [
  {
    id: "essentials",
    slug: "essentials",
    name: "Essentials",
    icon: "inbox",
    tagline: "Your inbox and calendar, handled every weekday.",
    weeklyHours: 20,
    hoursPerWeek: "20 hours a week",
    bestFor: "Founders and solo professionals getting their first assistant.",
    features: [
      "One dedicated VA, part-time",
      "Inbox triage and replies",
      "Calendar and meeting scheduling",
      "Data entry and document prep",
      "Weekly check-in with your VA",
    ],
    monthlyPrice: { 1: 90000, 6: 85500, 12: 81000 },
    currency: "USD",
  },
  {
    id: "executive",
    slug: "executive",
    name: "Executive",
    icon: "briefcase",
    tagline: "A full-time VA who runs your day before it starts.",
    weeklyHours: 40,
    hoursPerWeek: "40 hours a week",
    bestFor: "Busy leaders and small teams who need a right hand.",
    features: [
      "One dedicated VA, full-time",
      "Everything in Essentials",
      "Customer support and follow-ups",
      "Travel, expenses and vendor coordination",
      "Up to 3 active projects",
    ],
    monthlyPrice: { 1: 160000, 6: 152000, 12: 144000 },
    currency: "USD",
    featured: true,
  },
  {
    id: "day-and-night",
    slug: "day-and-night",
    name: "Day and night",
    icon: "clock",
    tagline: "Two VAs in shifts, so nothing waits until morning.",
    weeklyHours: 80,
    hoursPerWeek: "80 hours a week",
    bestFor: "Businesses with customers or teams across time zones.",
    features: [
      "Two dedicated VAs on day and night shifts",
      "Everything in Executive",
      "Shared handover notes between shifts",
      "Extended-hours customer coverage",
      "Monthly performance review",
    ],
    monthlyPrice: { 1: 300000, 6: 285000, 12: 270000 },
    currency: "USD",
  },
];

/** Lowest monthly price across commitment terms, shown as "from" on cards. */
export function startingPrice(pkg: Package) {
  return Math.min(...Object.values(pkg.monthlyPrice));
}

export function formatPrice(minor: number, currency = "USD", display: "symbol" | "code" = "symbol") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: display, maximumFractionDigits: 0 }).format(minor / 100);
}
