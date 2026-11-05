import "server-only";
import { db } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/dal";
import { safeEqual, ticketViewToken } from "@/lib/tickets/token";

export type TicketCredentials = { ticketToken?: string; orderToken?: string };

/**
 * A single ticket, if the requester controls it right now:
 *  - the current holder's link (ticket view token, rotates on transfer)
 *  - the buyer's order link, for tickets they haven't transferred away
 *  - a signed-in user whose email is the holder's, or an admin
 */
export async function getAuthorizedTicket(ticketId: string, creds: TicketCredentials) {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: {
      tier: true,
      event: { include: { venue: true } },
      order: { select: { id: true, reference: true, accessToken: true, buyerEmail: true, status: true } },
      transfers: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!ticket) return null;

  if (creds.ticketToken && safeEqual(creds.ticketToken, ticketViewToken(ticket.qrToken))) return ticket;
  if (creds.orderToken && !ticket.transferredAt && safeEqual(creds.orderToken, ticket.order.accessToken)) return ticket;

  const user = await getCurrentUser();
  if (user && (user.email === ticket.holderEmail || isAdmin(user))) return ticket;
  return null;
}
