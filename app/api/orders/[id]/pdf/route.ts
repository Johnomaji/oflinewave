import { getAuthorizedOrder } from "@/lib/data/orders";
import { loadOrderForTickets, ticketsPdfFor } from "@/lib/email/tickets";

export async function GET(request: Request, ctx: RouteContext<"/api/orders/[id]/pdf">) {
  const { id } = await ctx.params;
  const token = new URL(request.url).searchParams.get("t") ?? undefined;
  const authorized = await getAuthorizedOrder(id, token);
  if (!authorized || authorized.status !== "PAID") return new Response("Not found", { status: 404 });

  const order = await loadOrderForTickets(id);
  const pdf = await ticketsPdfFor(order);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="oflinewave-${order.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
