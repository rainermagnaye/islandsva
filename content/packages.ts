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

/** Every package is billed at one fixed hourly rate, in US cents. */
export const HOURLY_RATE_CENTS = 900;
/** A month averages 52 weeks / 12 months (about 4.33 weeks). */
export const WEEKS_PER_MONTH = 52 / 12;
/** Percent off the month-to-month price for a longer commitment. */
const TERM_DISCOUNT: Record<SubscriptionTerm, number> = { 1: 0, 6: 5, 12: 10 };

export const terms: { months: SubscriptionTerm; label: string; note: string }[] = [
  { months: 1, label: "Monthly", note: "Billed monthly" },
  { months: 6, label: "6 months", note: `Save ${TERM_DISCOUNT[6]}%` },
  { months: 12, label: "12 months", note: `Save ${TERM_DISCOUNT[12]}%` },
];

/**
 * Monthly price in US cents for weekly hours on a term: hours a week x $9 x 52/12 weeks, less the term's discount.
 * 20 h is $780 a month, 40 h $1,560 and 80 h $3,120, before discounts.
 */
export function monthlyPriceFor(weeklyHours: number, months: SubscriptionTerm) {
  return Math.round(weeklyHours * HOURLY_RATE_CENTS * WEEKS_PER_MONTH * (1 - TERM_DISCOUNT[months] / 100));
}

function pricesFor(weeklyHours: number): Record<SubscriptionTerm, number> {
  return { 1: monthlyPriceFor(weeklyHours, 1), 6: monthlyPriceFor(weeklyHours, 6), 12: monthlyPriceFor(weeklyHours, 12) };
}

// TODO(content): confirm package names and inclusions before launch.
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
    monthlyPrice: pricesFor(20),
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
    monthlyPrice: pricesFor(40),
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
    monthlyPrice: pricesFor(80),
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
