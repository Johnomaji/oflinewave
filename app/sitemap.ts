import type { MetadataRoute } from "next";
import { getSitemapEvents } from "@/lib/data/events";
import { appUrl } from "@/lib/utils";

const STATIC = ["", "/events", "/about", "/contact", "/faq", "/terms", "/privacy", "/refunds"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getSitemapEvents();
  return [
    ...STATIC.map((path) => ({ url: appUrl(path), changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.6 })),
    ...events.map((e) => ({ url: appUrl(`/events/${e.slug}`), lastModified: e.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
  ];
}
