import type { MetadataRoute } from "next";
import { unlistedRoutes } from "@/content/routes";
import { site } from "@/content/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", ...unlistedRoutes] },
    sitemap: new URL("/sitemap.xml", site.url).href,
  };
}
