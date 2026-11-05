import { db } from "@/lib/db";
import { scanGuard } from "@/lib/scan-auth";
import { qrFingerprint } from "@/lib/tickets/token";

/**
 * Compact ticket list for offline scanning. The device can match a QR's
 * ticket id against this list when the venue has no signal, then sync later.
 */
export async function GET(request: Request) {
  const user = await scanGuard(20);
  if (user instanceof Response) return user;

  const eventId = new URL(request.url).searchParams.get("event") ?? "";
  if (!eventId) return Response.json({ error: "event required" }, { status: 400 });

  const tickets = await db.ticket.findMany({
    where: { eventId, status: { in: ["VALID", "CHECKED_IN"] } },
    select: { id: true, code: true, holderName: true, status: true, qrToken: true, tier: { select: { name: true, admits: true } } },
  });
  return Response.json(
    {
      eventId,
      generatedAt: new Date().toISOString(),
      // [id, code, name, tier, admits, checkedIn, qrFingerprint]
      tickets: tickets.map((t) => [t.id, t.code, t.holderName, t.tier.name, t.tier.admits, t.status === "CHECKED_IN" ? 1 : 0, qrFingerprint(t.qrToken)]),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
