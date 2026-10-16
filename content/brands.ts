import type { IconName } from "@/types/icon";

export type Brand = {
  id: string;
  name: string;
  /** Path under /public. */
  logo: string;
  width: number;
  height: number;
};

/** Logos from the brands the team has worked with. Shown by name on /brands and in the home strip. */
export const brands: Brand[] = [
  { id: "vida", name: "Vida & Co", logo: "/brands/vida.png", width: 256, height: 260 },
  { id: "green-apple-active", name: "Green Apple Active", logo: "/brands/green-apple-active.png", width: 62, height: 72 },
  { id: "take-a-chef", name: "Take a Chef", logo: "/brands/take-a-chef.png", width: 1522, height: 304 },
  { id: "digifox", name: "Digifox", logo: "/brands/digifox.png", width: 1618, height: 1618 },
  { id: "bitflex", name: "Bitflex", logo: "/brands/bitflex.png", width: 1044, height: 1044 },
  { id: "koinly", name: "Koinly", logo: "/brands/koinly.png", width: 152, height: 199 },
  { id: "crossfi", name: "Crossfi.org", logo: "/brands/crossfi.png", width: 1354, height: 321 },
  { id: "hubby", name: "Hubby eSIM", logo: "/brands/hubby.png", width: 188, height: 82 },
  { id: "instant-hydration", name: "Instant Hydration", logo: "/brands/instant-hydration.png", width: 3942, height: 240 },
  { id: "double", name: "Double.online", logo: "/brands/double.png", width: 360, height: 46 },
  { id: "nectar", name: "Nectar", logo: "/brands/nectar.png", width: 1819, height: 364 },
  { id: "sniffspot", name: "Sniffspot", logo: "/brands/sniffspot.png", width: 1681, height: 302 },
  { id: "elephant-stock", name: "Elephant Stock", logo: "/brands/elephant-stock.png", width: 2076, height: 376 },
  { id: "forever-maps", name: "Forever Maps", logo: "/brands/forever-maps.png", width: 244, height: 121 },
  { id: "preply", name: "Preply", logo: "/brands/preply.png", width: 236, height: 110 },
  { id: "edunation", name: "Edunation", logo: "/brands/edunation.png", width: 374, height: 116 },
  { id: "simple", name: "Simple App", logo: "/brands/simple.png", width: 240, height: 74 },
  { id: "kea", name: "Kea.ai", logo: "/brands/kea.png", width: 400, height: 192 },
];

export const industries: { icon: IconName; title: string; description: string }[] = [
  { icon: "briefcase", title: "Professional services", description: "Consultants, coaches and agencies who bill for their time." },
  { icon: "home", title: "Real estate", description: "Agents and property managers juggling listings, viewings and tenants." },
  { icon: "message", title: "E-commerce", description: "Online stores that need fast, friendly customer replies." },
  { icon: "users", title: "Startups", description: "Founders who need operations support before their first hire." },
  { icon: "headset", title: "Customer-facing teams", description: "Businesses with customers awake while they sleep." },
  { icon: "shield", title: "Health and wellness", description: "Practices that need scheduling and admin handled with care." },
];
