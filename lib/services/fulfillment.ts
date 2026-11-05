import "server-only";
import { trackServer } from "@/lib/analytics";
import { defer } from "@/lib/defer";
import { awardOrderPoints } from "./loyalty";
import { db } from "@/lib/db";
import type { OrderStatus } from "@/lib/generated/prisma/client";
import { sendTicketEmail } from "@/lib/email/tickets";
import { newId } from "@/lib/ids";
import { getProvider } from "@/lib/payments";
import { createQrToken, createTicketCode } from "@/lib/tickets/token";

const FULFILLABLE: OrderStatus[] = ["PENDING", "FAILED"];

/**
 * Marks an order paid and issues its tickets. Idempotent: the order row is
 * locked and only PENDING/FAILED orders are fulfilled, so duplicate webhooks,
 * callback + webhook races, and retries all issue tickets exactly once.
 *
 * If a payment lands after its hold expired we still honour it: the buyer has
 * paid, so a rare oversell beats taking money without delivering a ticket.
 */
export async function fulfillOrder(orderId: string, opts: { paidAmount?: number; sendEmail?: boolean } = {}) {
  const fulfilled = await db.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ status: OrderStatus }[]>`
      SELECT status FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    if (!locked || !FULFILLABLE.includes(locked.status)) return false;

    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, addOns: true } });
    if (opts.paidAmount !== undefined && opts.paidAmount < order.total) {
      await tx.auditLog.create({
        data: {
          action: "payment.amount_mismatch",
          entity: "Order",
          entityId: order.id,
          data: { expected: order.total, paid: opts.paidAmount },
        },
      });
      return false;
    }

    await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date(), holdExpiresAt: null } });

    const tickets = order.items.flatMap((item) => {
      const issued = Array.from({ length: item.quantity }, (_, i) => {
        const id = newId();
        return {
          id,
          code: createTicketCode(),
          qrToken: createQrToken(id),
          orderId: order.id,
          eventId: order.eventId,
          tierId: item.tierId,
          holderName: item.attendeeNames[i] || order.buyerName,
          holderEmail: order.buyerEmail,
        };
      });
      return issued;
    });
    await tx.ticket.createMany({ data: tickets });

    for (const item of order.items) {
      await tx.ticketTier.update({ where: { id: item.tierId }, data: { sold: { increment: item.quantity } } });
    }
    for (const line of order.addOns) {
      await tx.addOn.update({ where: { id: line.addOnId }, data: { sold: { increment: line.quantity } } });
    }
    if (order.promoCodeId) {
      await tx.promoCode.update({ where: { id: order.promoCodeId }, data: { uses: { increment: 1 } } });
    }
    return true;
  });

  if (fulfilled) {
    if (opts.sendEmail !== false) defer(() => sendTicketEmail(orderId));
    defer(() => awardOrderPoints(orderId));
    defer(() => trackServer("paid", { orderId }));
  }
  return fulfilled;
}

/** Called from webhooks and the payment callback. */
export async function handlePaymentSuccess(reference: string, amount: number, raw: unknown) {
  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment) {
    console.warn("[payments] success for unknown reference", reference);
    return false;
  }
  if (payment.status !== "SUCCESS") {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESS", rawPayload: raw as object },
    });
  }
  return fulfillOrder(payment.orderId, { paidAmount: amount });
}

export async function handlePaymentFailure(reference: string, raw: unknown) {
  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment || payment.status === "SUCCESS") return;
  await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", rawPayload: raw as object } });
  // Only fail the order if no other attempt succeeded; releases the hold immediately.
  await db.order.updateMany({
    where: { id: payment.orderId, status: "PENDING" },
    data: { status: "FAILED", holdExpiresAt: null },
  });
}

/**
 * Buyer returned from the payment page. Ask the provider directly rather than
 * waiting for the webhook, so the confirmation page can show tickets right away.
 */
export async function reconcileOrder(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const payment = order?.payments[0];
  if (!order || order.status !== "PENDING" || !payment) return;

  try {
    const result = await getProvider(payment.provider).verify(payment.reference);
    if (result.status === "success") await handlePaymentSuccess(payment.reference, result.amount, result.raw);
    else if (result.status === "failed") await handlePaymentFailure(payment.reference, result.raw);
  } catch (error) {
    // The webhook will settle it; don't break the confirmation page.
    console.error("[payments] verify failed", payment.reference, error);
  }
}
