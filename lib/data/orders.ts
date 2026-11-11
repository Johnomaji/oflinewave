import "server-only";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/dal";

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Loads an order if the requester may see it: holder of the secret access
 * token (guest link), the signed-in buyer, or an admin. "Buyer" matches My tickets: the checkout
 * email, or the account that placed it (someone signed in can buy with a friend's email).
 */
export async function getAuthorizedOrder(orderId: string, token: string | undefined) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      event: { include: { venue: true } },
      items: { include: { tier: true } },
      addOns: { include: { addOn: { select: { name: true } } } },
      tickets: { include: { tier: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return null;
  if (token && safeEqual(token, order.accessToken)) return order;

  const user = await getCurrentUser();
  if (user && (user.email === order.buyerEmail || order.userId === user.id || isAdmin(user))) return order;
  return null;
}
