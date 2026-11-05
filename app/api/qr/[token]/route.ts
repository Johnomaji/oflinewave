import { qrPng } from "@/lib/tickets/qr";
import { verifyQrToken } from "@/lib/tickets/token";

/** QR image for emails. Only renders authentic tokens (the email already contains the token). */
export async function GET(_req: Request, ctx: RouteContext<"/api/qr/[token]">) {
  const { token } = await ctx.params;
  const decoded = decodeURIComponent(token);
  if (!verifyQrToken(decoded)) return new Response("Not found", { status: 404 });

  const png = await qrPng(decoded);
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
