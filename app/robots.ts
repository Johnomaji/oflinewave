import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/scan", "/api", "/orders", "/tickets", "/login", "/dev"] },
    sitemap: appUrl("/sitemap.xml"),
  };
}
