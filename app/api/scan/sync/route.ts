import { z } from "zod";
import { scanGuard } from "@/lib/scan-auth";
import { checkIn, checkInStats } from "@/lib/services/checkin";

const schema = z.object({
  eventId: z.string().min(1).max(40),
  ticketIds: z.array(z.string().min(1).max(40)).min(1).max(500),
});

/**
 * Uploads check-ins queued while offline. Each one goes through the same
 * atomic check-in; tickets someone else already scanned come back as conflicts.
 */
export async function POST(request: Request) {
  const user = await scanGuard(30);
  if (user instanceof Response) return user;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  const results = [];
  for (const ticketId of new Set(parsed.data.ticketIds)) {
    const result = await checkIn({ eventId: parsed.data.eventId, ticketId, staffId: user.id });
    results.push({ ticketId, state: result.state });
  }
  const stats = await checkInStats(parsed.data.eventId);
  return Response.json({
    synced: results.filter((r) => r.state === "valid").length,
    conflicts: results.filter((r) => r.state !== "valid"),
    stats,
  });
}
