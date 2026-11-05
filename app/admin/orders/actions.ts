"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { sendTicketEmail } from "@/lib/email/tickets";
import { nairaToKobo } from "@/lib/money";
import { fulfillOrder } from "@/lib/services/fulfillment";
import { RefundError, refundOrder, refundTicket } from "@/lib/services/refunds";
import { TransferError, renameTicket, transferTicket } from "@/lib/services/transfers";
import { createAccessToken, createOrderReference } from "@/lib/tickets/token";

export type ActionState = { ok?: string; error?: string };

export async function resendTickets(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const orderId = String(formData.get("orderId"));
  const to = String(formData.get("to") ?? "").trim();
  const email = to ? z.email().safeParse(to) : null;
  if (email && !email.success) return { error: "That email isn't valid." };
  await sendTicketEmail(orderId, { to: email?.data });
  await audit(user.id, "order.tickets_resent", "Order", orderId, { to: email?.data ?? null });
  return { ok: `Tickets sent${email?.data ? ` to ${email.data}` : ""}.` };
}

export async function refundOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const orderId = String(formData.get("orderId"));
  const reason = String(formData.get("reason") ?? "").slice(0, 300) || undefined;
  try {
    await refundOrder(orderId, user.id, reason);
  } catch (error) {
    if (error instanceof RefundError) return { error: error.message };
    console.error("[refund] order failed", orderId, error);
    return { error: error instanceof Error ? error.message : "Refund failed." };
  }
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: "Order refunded." };
}

export async function refundTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const ticketId = String(formData.get("ticketId"));
  const orderId = String(formData.get("orderId"));
  try {
    await refundTicket(ticketId, user.id);
  } catch (error) {
    if (error instanceof RefundError) return { error: error.message };
    console.error("[refund] ticket failed", ticketId, error);
    return { error: error instanceof Error ? error.message : "Refund failed." };
  }
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: "Ticket refunded." };
}

/** Validation failures inside the manual-order transaction, shown to the admin. */
class FormError extends Error {}

const manualSchema = z.object({
  eventId: z.string().min(1),
  tierId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(50),
  name: z.string().trim().min(2, "Enter a name").max(100),
  email: z.email("Enter a valid email").max(200),
  phone: z.string().trim().max(20).optional(),
  source: z.enum(["COMP", "CASH"]),
  amountNaira: z.coerce.number().min(0).max(100_000_000).default(0),
  sendEmail: z.coerce.boolean().optional(),
});

/** Door/box-office sale or guest-list comp. Issues tickets immediately. */
export async function createManualOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const parsed = manualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const total = d.source === "CASH" ? nairaToKobo(d.amountNaira) : 0;

  let orderId: string;
  try {
    orderId = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "TicketTier" WHERE id = ${d.tierId} FOR UPDATE`;
      const tier = await tx.ticketTier.findFirst({ where: { id: d.tierId, eventId: d.eventId } });
      if (!tier) throw new FormError("Pick a tier for this event.");
      const held = await tx.orderItem.aggregate({
        where: { tierId: tier.id, order: { status: "PENDING", holdExpiresAt: { gt: new Date() } } },
        _sum: { quantity: true },
      });
      const left = tier.quantity - tier.sold - (held._sum.quantity ?? 0);
      if (d.quantity > left) throw new FormError(`Only ${Math.max(left, 0)} ${tier.name} left. Raise the quantity on the event first.`);

      const order = await tx.order.create({
        data: {
          reference: createOrderReference(),
          eventId: d.eventId,
          buyerName: d.name,
          buyerEmail: d.email.toLowerCase(),
          buyerPhone: d.phone || null,
          source: d.source,
          subtotal: total,
          total,
          feeMode: "ABSORB",
          accessToken: createAccessToken(),
          items: { create: [{ tierId: tier.id, quantity: d.quantity, unitPrice: d.quantity ? Math.round(total / d.quantity) : 0 }] },
        },
      });
      return order.id;
    });
  } catch (error) {
    if (error instanceof FormError) return { error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError) return { error: "Couldn't save that order. Try again." };
    throw error;
  }

  await fulfillOrder(orderId, { sendEmail: d.sendEmail ?? false });
  await audit(user.id, `order.manual_${d.source.toLowerCase()}`, "Order", orderId, { quantity: d.quantity, total });
  redirect(`/admin/orders/${orderId}`);
}

/** Admin transfer / rename: ignores the buyer-facing window (e.g. door-side fixes). */
export async function adminChangeTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const ticketId = String(formData.get("ticketId"));
  const orderId = String(formData.get("orderId"));
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (name.length < 2) return { error: "Enter a name." };

  try {
    const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    if (email && email !== ticket.holderEmail) {
      if (!z.email().safeParse(email).success) return { error: "That email isn't valid." };
      await transferTicket(ticketId, { name, email }, { kind: "admin", userId: user.id });
      revalidatePath(`/admin/orders/${orderId}`);
      return { ok: `Transferred to ${email}. New QR sent; the old one is dead.` };
    }
    await renameTicket(ticketId, name, { kind: "admin", userId: user.id });
  } catch (error) {
    if (error instanceof TransferError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: "Name updated." };
}
