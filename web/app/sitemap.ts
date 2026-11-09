// sitemap.xml: the list of pages, dated by the latest test run,
// so search engines find every page and know when to come back.
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import report from "@/public/data/eval.json";
import type { Report } from "@/lib/types";

const PAGES = [
  { path: "", priority: 1 },
  { path: "/how-it-works", priority: 0.9 },
  { path: "/results", priority: 0.8 },
  { path: "/playground", priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const runDate = (report as unknown as Report).summary?.run_date;
  const updated = runDate ? new Date(runDate + "T00:00:00Z") : undefined;
  return PAGES.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: updated,
    changeFrequency: "monthly",
    priority: p.priority,
  }));
}
