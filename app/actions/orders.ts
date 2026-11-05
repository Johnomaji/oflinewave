"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthorizedOrder } from "@/lib/data/orders";
import { startPayment } from "@/lib/services/checkout";

/** "Pay now" on a pending order whose hold is still active. */
export async function retryPayment(formData: FormData) {
  const orderId = String(formData.get("orderId"));
  const token = String(formData.get("token") ?? "");
  const order = await getAuthorizedOrder(orderId, token);
  if (!order || order.status !== "PENDING" || !order.holdExpiresAt || order.holdExpiresAt < new Date()) {
    redirect(order ? `/events/${order.event.slug}/checkout` : "/events");
  }
  const fresh = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  redirect(await startPayment(fresh));
}
