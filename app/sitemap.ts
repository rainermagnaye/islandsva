import type { MetadataRoute } from "next";
import { routes, unlistedRoutes, type RoutePath } from "@/content/routes";
import { site } from "@/content/site";

const priority: Partial<Record<RoutePath, number>> = {
  [routes.home]: 1,
  [routes.packages]: 0.8,
  [routes.contact]: 0.8,
};

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(routes)
    .filter((path) => !unlistedRoutes.includes(path))
    .map((path) => ({
      url: new URL(path, site.url).href,
      changeFrequency: "monthly",
      priority: priority[path] ?? 0.5,
    }));
}
