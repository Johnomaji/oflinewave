import { getAuthorizedTicket } from "@/lib/data/tickets";
import { applePass, walletConfig } from "@/lib/tickets/wallet";

export async function GET(request: Request, ctx: RouteContext<"/api/tickets/[id]/wallet/apple">) {
  if (!walletConfig.apple()) return new Response("Apple Wallet isn't configured", { status: 404 });
  const { id } = await ctx.params;
  const ticket = await getAuthorizedTicket(id, { ticketToken: new URL(request.url).searchParams.get("t") ?? undefined });
  if (!ticket || ticket.status !== "VALID") return new Response("Not found", { status: 404 });

  try {
    const pass = await applePass({
      id: ticket.id,
      code: ticket.code,
      qrToken: ticket.qrToken,
      holderName: ticket.holderName,
      tierName: ticket.tier.name,
      admits: ticket.tier.admits,
      event: ticket.event,
      orderReference: ticket.order.reference,
    });
    return new Response(new Uint8Array(pass), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="oflinewave-${ticket.code}.pkpass"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[wallet] apple pass failed", error);
    return new Response("Couldn't build the pass", { status: 500 });
  }
}
