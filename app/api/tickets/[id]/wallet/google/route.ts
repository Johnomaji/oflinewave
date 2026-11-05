import { getAuthorizedTicket } from "@/lib/data/tickets";
import { googleWalletUrl, walletConfig } from "@/lib/tickets/wallet";

export async function GET(request: Request, ctx: RouteContext<"/api/tickets/[id]/wallet/google">) {
  if (!walletConfig.google()) return new Response("Google Wallet isn't configured", { status: 404 });
  const { id } = await ctx.params;
  const ticket = await getAuthorizedTicket(id, { ticketToken: new URL(request.url).searchParams.get("t") ?? undefined });
  if (!ticket || ticket.status !== "VALID") return new Response("Not found", { status: 404 });

  try {
    const url = await googleWalletUrl({
      id: ticket.id,
      code: ticket.code,
      qrToken: ticket.qrToken,
      holderName: ticket.holderName,
      tierName: ticket.tier.name,
      admits: ticket.tier.admits,
      event: ticket.event,
      orderReference: ticket.order.reference,
    });
    return Response.redirect(url, 302);
  } catch (error) {
    console.error("[wallet] google save link failed", error);
    return new Response("Couldn't build the wallet link", { status: 500 });
  }
}
