import { getAuthorizedTicket } from "@/lib/data/tickets";
import { loadOrderForTickets, ticketsPdfFor } from "@/lib/email/tickets";

/** PDF of a single ticket for its current holder. */
export async function GET(request: Request, ctx: RouteContext<"/api/tickets/[id]/pdf">) {
  const { id } = await ctx.params;
  const token = new URL(request.url).searchParams.get("t") ?? undefined;
  const ticket = await getAuthorizedTicket(id, { ticketToken: token });
  if (!ticket || ticket.status !== "VALID") return new Response("Not found", { status: 404 });

  const order = await loadOrderForTickets(ticket.orderId);
  const pdf = await ticketsPdfFor(order, order.tickets.filter((t) => t.id === id));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="oflinewave-${ticket.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
