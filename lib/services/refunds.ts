import "server-only";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { defer } from "@/lib/defer";
import { getProvider } from "@/lib/payments";
import { notifyWaitlist } from "./waitlist";

export class RefundError extends Error {}

async function providerRefund(orderId: string, amount: number) {
  if (amount <= 0) return { providerRef: null, status: "PROCESSED" as const };
  const payment = await db.payment.findFirst({ where: { orderId, status: "SUCCESS" }, orderBy: { createdAt: "desc" } });
  if (!payment) return { providerRef: null, status: "PROCESSED" as const }; // comp / cash sale
  const result = await getProvider(payment.provider).refund(payment.reference, amount);
  return { providerRef: result.providerRef, status: result.status === "processed" ? ("PROCESSED" as const) : ("PENDING" as const) };
}

/** Refund a whole order: buyer gets back everything they paid, tickets are voided. */
export async function refundOrder(orderId: string, actorId: string, reason?: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { tickets: true, refunds: true, addOns: true } });
  if (order.status !== "PAID") throw new RefundError("Only paid orders can be refunded.");

  const alreadyRefunded = order.refunds.filter((r) => r.status !== "FAILED").reduce((s, r) => s + r.amount, 0);
  const amount = Math.max(order.total - alreadyRefunded, 0);
  const result = await providerRefund(order.id, amount);

  const live = order.tickets.filter((t) => t.status === "VALID" || t.status === "CHECKED_IN");
  await db.$transaction(async (tx) => {
    await tx.refund.create({
      data: { orderId, amount, reason, status: result.status, providerRef: result.providerRef, createdById: actorId },
    });
    await tx.ticket.updateMany({ where: { id: { in: live.map((t) => t.id) } }, data: { status: "REFUNDED" } });
    await tx.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } });
    await tx.payment.updateMany({ where: { orderId, status: "SUCCESS" }, data: { status: "REFUNDED" } });
    await releaseInventory(tx, live);
    for (const line of order.addOns) {
      await tx.addOn.update({ where: { id: line.addOnId }, data: { sold: { decrement: line.quantity } } });
    }
  });
  await audit(actorId, "order.refunded", "Order", orderId, { amount, reason: reason ?? null });
  if (live.length) defer(() => notifyWaitlist(order.eventId));
}

/** Refund one ticket at its share of what was paid (fees stay with the order). */
export async function refundTicket(ticketId: string, actorId: string, reason?: string) {
  const ticket = await db.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { order: { include: { items: true, tickets: true } } },
  });
  if (ticket.status !== "VALID" && ticket.status !== "CHECKED_IN") throw new RefundError("Ticket is already void.");
  const { order } = ticket;
  if (order.status !== "PAID") throw new RefundError("Only tickets on paid orders can be refunded.");

  const item = order.items.find((i) => i.tierId === ticket.tierId);
  const unitPrice = item?.unitPrice ?? 0;
  const net = order.subtotal - order.discount;
  const amount = order.subtotal > 0 ? Math.round((unitPrice * net) / order.subtotal) : 0;
  const result = await providerRefund(order.id, amount);

  const othersLive = order.tickets.some((t) => t.id !== ticket.id && (t.status === "VALID" || t.status === "CHECKED_IN"));
  await db.$transaction(async (tx) => {
    await tx.refund.create({
      data: { orderId: order.id, ticketId, amount, reason, status: result.status, providerRef: result.providerRef, createdById: actorId },
    });
    await tx.ticket.update({ where: { id: ticketId }, data: { status: "REFUNDED" } });
    if (!othersLive) await tx.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
    await releaseInventory(tx, [ticket]);
  });
  await audit(actorId, "ticket.refunded", "Ticket", ticketId, { amount, reason: reason ?? null });
  defer(() => notifyWaitlist(ticket.eventId));
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function releaseInventory(tx: Tx, tickets: { tierId: string }[]) {
  const byTier = new Map<string, number>();
  for (const t of tickets) byTier.set(t.tierId, (byTier.get(t.tierId) ?? 0) + 1);
  for (const [tierId, count] of byTier) {
    await tx.ticketTier.update({ where: { id: tierId }, data: { sold: { decrement: count } } });
  }
}
