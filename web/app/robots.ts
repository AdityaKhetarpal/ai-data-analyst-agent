// robots.txt: every crawler, including AI search bots (OAI-SearchBot, Claude-SearchBot, PerplexityBot),
// may read every page. Only the API route is skipped, because it isn't a page.
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
