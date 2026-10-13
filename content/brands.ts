import type { IconName } from "@/types/icon";

export type Brand = {
  id: string;
  name: string;
  /** Path under /public, e.g. /brands/acme.svg (SVG preferred). */
  logo: string;
  url?: string;
};

// Client brands shown only with the client's permission. The brand strip stays hidden while this is empty.
export const brands: Brand[] = [];

export const industries: { icon: IconName; title: string; description: string }[] = [
  { icon: "briefcase", title: "Professional services", description: "Consultants, coaches and agencies who bill for their time." },
  { icon: "home", title: "Real estate", description: "Agents and property managers juggling listings, viewings and tenants." },
  { icon: "message", title: "E-commerce", description: "Online stores that need fast, friendly customer replies." },
  { icon: "users", title: "Startups", description: "Founders who need operations support before their first hire." },
  { icon: "headset", title: "Customer-facing teams", description: "Businesses with customers awake while they sleep." },
  { icon: "shield", title: "Health and wellness", description: "Practices that need scheduling and admin handled with care." },
];
