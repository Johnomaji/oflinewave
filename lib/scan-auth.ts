import "server-only";
import { canScan, getCurrentUser, type CurrentUser } from "@/lib/dal";
import { rateLimit } from "@/lib/rate-limit";

/** Auth + rate limit for scanner endpoints. Returns the staff user or an error Response. */
export async function scanGuard(limit = 120): Promise<CurrentUser | Response> {
  const user = await getCurrentUser();
  if (!user || !canScan(user)) return Response.json({ error: "Sign in as door staff" }, { status: 401 });
  const rl = rateLimit(`scan:${user.id}`, limit, 60_000);
  if (!rl.ok) return Response.json({ error: "Slow down" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  return user;
}
