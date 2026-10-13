import type { MetadataRoute } from "next";
import { appRoutes } from "@/content/routes";
import { site } from "@/content/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", ...Object.values(appRoutes)] },
    sitemap: new URL("/sitemap.xml", site.url).href,
  };
}
