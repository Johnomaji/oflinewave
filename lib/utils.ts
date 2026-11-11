import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const PROBE_ORIGIN = "http://same-site.invalid";

/**
 * `value` if it's a path on this site, else `fallback`. A prefix check isn't enough: browsers treat
 * "\" as "/" and drop tabs and newlines, so "/\evil.com" and "/\t/evil.com" both lead to another
 * site. Resolve it the way a browser would and keep it only if it stays here.
 */
export function safeRedirectPath(value: unknown, fallback = "/tickets") {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  try {
    const url = new URL(value, PROBE_ORIGIN);
    return url.origin === PROBE_ORIGIN ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export function appUrl(path = "") {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
