import "server-only";
import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function bucketFor(key: string, windowMs: number) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
    }
  }
  return bucket;
}

/**
 * Fixed-window limiter, in memory per server instance. Enough to blunt abuse
 * on a single region; swap for Upstash/Redis if you run many instances.
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const bucket = bucketFor(key, windowMs);
  bucket.count += 1;
  return { ok: bucket.count <= limit, retryAfter: Math.ceil((bucket.resetAt - Date.now()) / 1000) };
}

/**
 * Takes back one hit, for limits that should only count failures. Count the attempt up front with
 * rateLimit() (so attempts running at the same time all count), then forgive it if it succeeded.
 */
export function forgive(key: string) {
  const bucket = buckets.get(key);
  if (bucket && bucket.count > 0) bucket.count -= 1;
}

/**
 * The visitor's IP. Every proxy in front of the app appends the address it saw to X-Forwarded-For,
 * so the first entries are whatever the client sent. Only the ones our own proxies added can be
 * trusted: TRUSTED_PROXIES of them, counted from the end (default 1, the host's own proxy).
 */
export function ipFromHeaders(h: Headers) {
  const chain = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const hops = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXIES ?? "", 10) || 1);
  return chain[Math.max(0, chain.length - hops)] || h.get("x-real-ip") || "local";
}

export async function clientIp() {
  return ipFromHeaders(await headers());
}
