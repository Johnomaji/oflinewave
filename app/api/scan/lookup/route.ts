import { scanGuard } from "@/lib/scan-auth";
import { lookupTickets } from "@/lib/services/checkin";

export async function GET(request: Request) {
  const user = await scanGuard(60);
  if (user instanceof Response) return user;

  const sp = new URL(request.url).searchParams;
  const eventId = sp.get("event") ?? "";
  const q = (sp.get("q") ?? "").slice(0, 100);
  if (!eventId) return Response.json({ error: "event required" }, { status: 400 });

  const tickets = await lookupTickets(eventId, q);
  return Response.json({
    tickets: tickets.map((t) => ({
      id: t.id,
      code: t.code,
      holderName: t.holderName,
      holderEmail: t.holderEmail,
      tierName: t.tier.name,
      status: t.status,
      checkedInAt: t.checkedInAt?.toISOString() ?? null,
    })),
  });
}
