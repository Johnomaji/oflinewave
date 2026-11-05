import type { DiscountType, FeeMode } from "@/lib/generated/prisma/enums";

export type PricingLine = { tierId: string; unitPrice: number; quantity: number };
export type PricingPromo = { type: DiscountType; value: number; tierIds: string[] };
/** Extras (drinks, parking…). Count toward the percentage fee; promos and the flat per-ticket fee don't apply. */
export type PricingAddOn = { unitPrice: number; quantity: number };
export type FeeRule = { feePercentBps: number; feeFlat: number; feeMode: FeeMode };

export type Pricing = {
  subtotal: number;
  discount: number;
  fees: number;
  /** what the buyer pays */
  total: number;
  /** what the organizer keeps */
  payout: number;
  feeMode: FeeMode;
};

/**
 * Single source of truth for order maths. Used by the checkout UI (preview)
 * and the server (authoritative), so the numbers always match.
 *
 * Fee = percentage of the discounted amount + a flat fee per paid ticket.
 * Free tickets never carry a fee. Promo codes discount tickets only.
 */
export function computePricing(
  lines: PricingLine[],
  rule: FeeRule,
  promo?: PricingPromo | null,
  addOns: PricingAddOn[] = [],
): Pricing {
  const ticketTotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const addOnTotal = addOns.reduce((sum, a) => sum + a.unitPrice * a.quantity, 0);
  const subtotal = ticketTotal + addOnTotal;

  let discount = 0;
  if (promo) {
    const eligible = lines
      .filter((l) => promo.tierIds.length === 0 || promo.tierIds.includes(l.tierId))
      .reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    discount =
      promo.type === "PERCENT"
        ? Math.floor((eligible * Math.min(promo.value, 100)) / 100)
        : Math.min(promo.value, eligible);
  }

  const net = subtotal - discount;
  const paidTickets = lines.filter((l) => l.unitPrice > 0).reduce((sum, l) => sum + l.quantity, 0);
  const fees = net > 0 ? Math.round((net * rule.feePercentBps) / 10_000) + rule.feeFlat * paidTickets : 0;

  const passToBuyer = rule.feeMode === "PASS_TO_BUYER";
  return {
    subtotal,
    discount,
    fees,
    total: passToBuyer ? net + fees : net,
    payout: passToBuyer ? net : Math.max(net - fees, 0),
    feeMode: rule.feeMode,
  };
}
