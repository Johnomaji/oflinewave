import "server-only";
import { db } from "@/lib/db";
import { safeEqual, verifyQrToken } from "@/lib/tickets/token";

export type ScanResult =
  | { state: "valid"; ticket: ScanTicket; addOns: ScanAddOn[] }
  | { state: "used"; ticket: ScanTicket; checkedInAt: string; checkedInBy: string | null; addOns: ScanAddOn[] }
  | { state: "wrong_event"; ticket: ScanTicket; eventTitle: string }
  | { state: "invalid"; reason: string; ticket?: ScanTicket };

/** Pre-ordered extras on the ticket's order, to hand over at the door. */
export type ScanAddOn = { id: string; name: string; quantity: number; redeemed: number };

export type ScanTicket = { id: string; code: string; holderName: string; tierName: string; admits: number };

const include = {
  tier: true,
  event: { select: { title: true } },
  checkedInBy: { select: { name: true, email: true } },
  order: { select: { addOns: { include: { addOn: { select: { name: true } } } } } },
};

/**
 * Atomic check-in: the conditional UPDATE (status = VALID → CHECKED_IN) can
 * only succeed once, so two staff scanning the same ticket at the same moment
 * get one VALID and one ALREADY USED.
 */
export async function checkIn(params: { eventId: string; staffId: string; token?: string; ticketId?: string }): Promise<ScanResult> {
  const ticketId = params.ticketId ?? (params.token ? verifyQrToken(params.token) : null);
  if (!ticketId) return { state: "invalid", reason: "Not an Oflinewave ticket" };

  const ticket = await db.ticket.findUnique({ where: { id: ticketId }, include });
  if (!ticket) return { state: "invalid", reason: "Ticket not found" };

  const summary: ScanTicket = {
    id: ticket.id,
    code: ticket.code,
    holderName: ticket.holderName,
    tierName: ticket.tier.name,
    admits: ticket.tier.admits,
  };

  // Signature checks out but the ticket has a newer QR (it was transferred).
  if (params.token && !safeEqual(params.token.trim(), ticket.qrToken)) {
    return { state: "invalid", reason: "Old QR. This ticket was transferred to someone else", ticket: summary };
  }
  const addOns: ScanAddOn[] = ticket.order.addOns.map((a) => ({ id: a.id, name: a.addOn.name, quantity: a.quantity, redeemed: a.redeemed }));

  if (ticket.eventId !== params.eventId) return { state: "wrong_event", ticket: summary, eventTitle: ticket.event.title };
  if (ticket.status === "REFUNDED") return { state: "invalid", reason: "Ticket was refunded", ticket: summary };
  if (ticket.status === "CANCELLED") return { state: "invalid", reason: "Ticket was cancelled", ticket: summary };

  const { count } = await db.ticket.updateMany({
    where: { id: ticket.id, status: "VALID" },
    data: { status: "CHECKED_IN", checkedInAt: new Date(), checkedInById: params.staffId },
  });
  if (count === 1) return { state: "valid", ticket: summary, addOns };

  const used = await db.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include });
  return {
    state: "used",
    ticket: summary,
    checkedInAt: (used.checkedInAt ?? new Date()).toISOString(),
    checkedInBy: used.checkedInBy?.name ?? used.checkedInBy?.email ?? null,
    addOns,
  };
}

export async function checkInStats(eventId: string) {
  const [checkedIn, total] = await Promise.all([
    db.ticket.count({ where: { eventId, status: "CHECKED_IN" } }),
    db.ticket.count({ where: { eventId, status: { in: ["VALID", "CHECKED_IN"] } } }),
  ]);
  return { checkedIn, total };
}

/** Manual lookup fallback: name, email, ticket code or order reference. */
export async function lookupTickets(eventId: string, query: string) {
  const q = query.trim();
  if (q.length < 2) return [];
  return db.ticket.findMany({
    where: {
      eventId,
      OR: [
        { holderName: { contains: q, mode: "insensitive" } },
        { holderEmail: { contains: q, mode: "insensitive" } },
        { code: q.toUpperCase() },
        { order: { reference: { contains: q.toUpperCase() } } },
      ],
    },
    include: { tier: { select: { name: true } } },
    orderBy: { holderName: "asc" },
    take: 20,
  });
}

/** Hand over pre-ordered extras. Atomic: can't hand over more than were bought. */
export async function redeemAddOn(orderAddOnId: string, eventId: string) {
  const line = await db.orderAddOn.findUnique({ where: { id: orderAddOnId }, include: { order: { select: { eventId: true, status: true } } } });
  if (!line || line.order.eventId !== eventId || line.order.status !== "PAID") return { ok: false as const, error: "Not found for this event" };
  const updated = await db.$executeRaw`
    UPDATE "OrderAddOn" SET redeemed = redeemed + 1 WHERE id = ${orderAddOnId} AND redeemed < quantity`;
  if (updated === 0) return { ok: false as const, error: "Already collected" };
  return { ok: true as const, redeemed: line.redeemed + 1, quantity: line.quantity };
}
