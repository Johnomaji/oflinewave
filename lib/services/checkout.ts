import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { PromoCode, TicketTier } from "@/lib/generated/prisma/client";
import { getActiveProvider } from "@/lib/payments";
import { computePricing, type Pricing } from "@/lib/pricing";
import { readSettings } from "@/lib/settings";
import { createAccessToken, createOrderReference } from "@/lib/tickets/token";
import { appUrl } from "@/lib/utils";
import { fulfillOrder } from "./fulfillment";
import { isMember } from "./loyalty";

export const HOLD_MINUTES = 10;

/** Errors safe to show to the buyer. */
export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

type Tx = Prisma.TransactionClient;

export type CheckoutInput = {
  eventId: string;
  items: { tierId: string; quantity: number; attendeeNames?: string[] }[];
  buyer: { name: string; email: string; phone?: string };
  addOns?: { addOnId: string; quantity: number }[];
  promoCode?: string;
  userId?: string | null;
  /** signed-in user's email, for member-only tiers */
  userEmail?: string | null;
};

export type CheckoutResult =
  | { kind: "redirect"; url: string; orderId: string }
  | { kind: "complete"; orderId: string; accessToken: string };

/** Units held by unexpired pending orders, per tier. */
async function heldByTier(tx: Tx | typeof db, tierIds: string[], now: Date) {
  const rows = await tx.orderItem.groupBy({
    by: ["tierId"],
    where: { tierId: { in: tierIds }, order: { status: "PENDING", holdExpiresAt: { gt: now } } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.tierId, r._sum.quantity ?? 0]));
}

/** Add-on units held by unexpired pending orders. */
async function heldByAddOn(tx: Tx | typeof db, addOnIds: string[], now: Date) {
  if (addOnIds.length === 0) return new Map<string, number>();
  const rows = await tx.orderAddOn.groupBy({
    by: ["addOnId"],
    where: { addOnId: { in: addOnIds }, order: { status: "PENDING", holdExpiresAt: { gt: now } } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.addOnId, r._sum.quantity ?? 0]));
}

export async function getAddOnAvailability(eventId: string) {
  const addOns = await db.addOn.findMany({ where: { eventId, active: true }, select: { id: true, quantity: true, sold: true } });
  const held = await heldByAddOn(
    db,
    addOns.map((a) => a.id),
    new Date(),
  );
  return Object.fromEntries(addOns.map((a) => [a.id, remaining(a, held.get(a.id) ?? 0)]));
}

export function remaining(tier: Pick<TicketTier, "quantity" | "sold">, held: number) {
  return Math.max(tier.quantity - tier.sold - held, 0);
}

/** Live availability for display. Not locked; checkout re-checks under a lock. */
export async function getAvailability(eventId: string) {
  const tiers = await db.ticketTier.findMany({ where: { eventId }, select: { id: true, quantity: true, sold: true } });
  const held = await heldByTier(
    db,
    tiers.map((t) => t.id),
    new Date(),
  );
  return Object.fromEntries(tiers.map((t) => [t.id, remaining(t, held.get(t.id) ?? 0)]));
}

export async function findUsablePromo(
  tx: Tx | typeof db,
  code: string,
  eventId: string,
  now = new Date(),
): Promise<PromoCode> {
  const promo = await tx.promoCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (
    !promo ||
    !promo.active ||
    (promo.eventId && promo.eventId !== eventId) ||
    (promo.expiresAt && promo.expiresAt < now) ||
    (promo.maxUses !== null && promo.uses >= promo.maxUses)
  ) {
    throw new CheckoutError("That code isn't valid for this event.");
  }
  return promo;
}

function assertTierOnSale(tier: TicketTier, now: Date) {
  if (tier.salesStart && tier.salesStart > now) throw new CheckoutError(`${tier.name} isn't on sale yet.`);
  if (tier.salesEnd && tier.salesEnd < now) throw new CheckoutError(`${tier.name} sales have ended.`);
}

/**
 * Creates an order and holds inventory for HOLD_MINUTES.
 *
 * Race safety: tier rows are locked with SELECT … FOR UPDATE, so concurrent
 * checkouts for the same tier run one at a time and each sees the others' holds.
 */
export async function createOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const now = new Date();
  const tierIds = [...new Set(input.items.map((i) => i.tierId))];
  if (tierIds.length === 0 || tierIds.length !== input.items.length) {
    throw new CheckoutError("Pick at least one ticket.");
  }

  const order = await db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: input.eventId } });
    if (!event || event.status !== "PUBLISHED" || (event.endsAt ?? event.startsAt) < now) {
      throw new CheckoutError("This event isn't selling tickets right now.");
    }

    await tx.$queryRaw`SELECT id FROM "TicketTier" WHERE id IN (${Prisma.join(tierIds)}) FOR UPDATE`;
    const tiers = await tx.ticketTier.findMany({ where: { id: { in: tierIds }, eventId: event.id } });
    if (tiers.length !== tierIds.length) throw new CheckoutError("Some tickets are no longer available.");
    const tierById = new Map(tiers.map((t) => [t.id, t]));

    const promo = input.promoCode ? await findUsablePromo(tx, input.promoCode, event.id, now) : null;
    if (promo?.referrerEmail && promo.referrerEmail === input.buyer.email.toLowerCase()) {
      throw new CheckoutError("That's your own referral code. Share it with friends instead.");
    }
    const held = await heldByTier(tx, tierIds, now);
    const needsMembership = tiers.some((t) => t.visibility === "MEMBERS");
    const member = needsMembership ? await isMember(input.userEmail) : false;

    for (const item of input.items) {
      const tier = tierById.get(item.tierId)!;
      assertTierOnSale(tier, now);
      if (tier.visibility === "HIDDEN" && !promo?.tierIds.includes(tier.id)) {
        throw new CheckoutError(`${tier.name} needs an access code.`);
      }
      if (tier.visibility === "MEMBERS" && !member) {
        throw new CheckoutError(`${tier.name} is for Wave Club members. Sign in with the email you've bought with before.`);
      }
      if (item.quantity < tier.minPerOrder || item.quantity > tier.maxPerOrder) {
        throw new CheckoutError(`${tier.name}: choose between ${tier.minPerOrder} and ${tier.maxPerOrder}.`);
      }
      const left = remaining(tier, held.get(tier.id) ?? 0);
      if (item.quantity > left) {
        throw new CheckoutError(left === 0 ? `${tier.name} just sold out.` : `Only ${left} ${tier.name} left.`);
      }
    }

    // Add-ons: lock rows, check stock, same as tiers.
    const addOnLines = input.addOns?.filter((a) => a.quantity > 0) ?? [];
    const addOnIds = [...new Set(addOnLines.map((a) => a.addOnId))];
    if (addOnIds.length !== addOnLines.length) throw new CheckoutError("Check your add-ons.");
    let addOnById = new Map<string, { id: string; name: string; price: number; quantity: number; sold: number; maxPerOrder: number }>();
    if (addOnIds.length) {
      await tx.$queryRaw`SELECT id FROM "AddOn" WHERE id IN (${Prisma.join(addOnIds)}) FOR UPDATE`;
      const rows = await tx.addOn.findMany({ where: { id: { in: addOnIds }, eventId: event.id, active: true } });
      if (rows.length !== addOnIds.length) throw new CheckoutError("An add-on is no longer available.");
      addOnById = new Map(rows.map((a) => [a.id, a]));
      const heldAddOns = await heldByAddOn(tx, addOnIds, now);
      for (const line of addOnLines) {
        const addOn = addOnById.get(line.addOnId)!;
        if (line.quantity > addOn.maxPerOrder) throw new CheckoutError(`${addOn.name}: max ${addOn.maxPerOrder} per order.`);
        const left = remaining(addOn, heldAddOns.get(addOn.id) ?? 0);
        if (line.quantity > left) throw new CheckoutError(left === 0 ? `${addOn.name} just sold out.` : `Only ${left} ${addOn.name} left.`);
      }
    }

    const settings = await readSettings();
    const pricing: Pricing = computePricing(
      input.items.map((i) => ({ tierId: i.tierId, quantity: i.quantity, unitPrice: tierById.get(i.tierId)!.price })),
      {
        feePercentBps: settings.feePercentBps,
        feeFlat: settings.feeFlat,
        feeMode: event.feeMode ?? settings.defaultFeeMode,
      },
      promo,
      addOnLines.map((a) => ({ quantity: a.quantity, unitPrice: addOnById.get(a.addOnId)!.price })),
    );

    return tx.order.create({
      data: {
        reference: createOrderReference(),
        eventId: event.id,
        userId: input.userId ?? null,
        buyerName: input.buyer.name,
        buyerEmail: input.buyer.email.toLowerCase(),
        buyerPhone: input.buyer.phone || null,
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        fees: pricing.fees,
        total: pricing.total,
        feeMode: pricing.feeMode,
        promoCodeId: promo?.id ?? null,
        holdExpiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000),
        accessToken: createAccessToken(),
        items: {
          create: input.items.map((i) => ({
            tierId: i.tierId,
            quantity: i.quantity,
            unitPrice: tierById.get(i.tierId)!.price,
            attendeeNames: (i.attendeeNames ?? []).map((n) => n.trim()).slice(0, i.quantity),
          })),
        },
        addOns: {
          create: addOnLines.map((a) => ({ addOnId: a.addOnId, quantity: a.quantity, unitPrice: addOnById.get(a.addOnId)!.price })),
        },
      },
    });
  });

  // Free RSVP (or 100% discount): no payment step.
  if (order.total === 0) {
    await fulfillOrder(order.id);
    return { kind: "complete", orderId: order.id, accessToken: order.accessToken };
  }

  return { kind: "redirect", url: await startPayment(order), orderId: order.id };
}

/** Starts (or restarts) payment for a pending order. Each attempt gets its own reference. */
export async function startPayment(order: { id: string; reference: string; total: number; buyerEmail: string; accessToken: string }) {
  const provider = getActiveProvider();
  const attempt = await db.payment.count({ where: { orderId: order.id } });
  const reference = `${order.reference}-${attempt + 1}`;

  await db.payment.create({
    data: { orderId: order.id, provider: provider.id, reference, amount: order.total },
  });

  const { redirectUrl } = await provider.initialize({
    reference,
    amount: order.total,
    email: order.buyerEmail,
    callbackUrl: appUrl(`/orders/${order.id}?t=${order.accessToken}&verify=1`),
    metadata: { orderId: order.id, orderReference: order.reference },
  });
  return redirectUrl;
}
