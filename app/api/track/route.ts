import { z } from "zod";
import { trackServer, visitorHash } from "@/lib/analytics";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  type: z.enum(["event_view", "checkout_view"]),
  eventId: z.string().min(1).max(40),
  referrer: z.string().max(500).optional(),
});

/** Beacon endpoint for page-view funnel steps. Always answers 204. */
export async function POST(request: Request) {
  if (!rateLimit(`track:${await clientIp()}`, 60, 60_000).ok) return new Response(null, { status: 204 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (parsed.success) {
    // Keep only the referring host: no paths, no query strings.
    let referrer: string | null = null;
    try {
      referrer = parsed.data.referrer ? new URL(parsed.data.referrer).hostname.replace(/^www\./, "") : null;
    } catch {
      referrer = null;
    }
    await trackServer(parsed.data.type, { eventId: parsed.data.eventId, referrer, visitor: await visitorHash() });
  }
  return new Response(null, { status: 204 });
}
