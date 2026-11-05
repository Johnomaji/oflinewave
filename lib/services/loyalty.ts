import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { createTicketCode } from "@/lib/tickets/token";

/**
 * Wave Club: points for every order, tiers by lifetime points, member-only
 * ticket tiers, and referral codes. Accounts are keyed by email so guest
 * purchases count before someone ever signs in.
 */
export const WAVE_TIERS = [
  { name: "Wave", min: 0, perk: "Member-only tickets and early drops" },
  { name: "Swell", min: 1_000, perk: "Everything in Wave, plus priority waitlist" },
  { name: "Tsunami", min: 5_000, perk: "Everything in Swell, plus guest-list surprises" },
] as const;

/** 1 point per ₦100 spent, minimum 10 per order (free RSVPs count too). */
export const pointsForOrder = (totalKobo: number) => Math.max(Math.floor(totalKobo / 10_000), 10);
export const REFERRAL_POINTS = 500;
export const REFERRAL_DISCOUNT_PERCENT = 10;

export function tierFor(lifetimePoints: number) {
  let current: (typeof WAVE_TIERS)[number] = WAVE_TIERS[0];
  for (const tier of WAVE_TIERS) if (lifetimePoints >= tier.min) current = tier;
  const next = WAVE_TIERS.find((t) => t.min > lifetimePoints) ?? null;
  return { current, next, toNext: next ? next.min - lifetimePoints : 0 };
}

export function getAccount(email: string) {
  return db.loyaltyAccount.findUnique({ where: { email: email.toLowerCase() } });
}

/** Members = anyone with Wave Club history (at least one order). */
export async function isMember(email: string | null | undefined) {
  if (!email) return false;
  const account = await getAccount(email);
  return Boolean(account && account.lifetimePoints > 0);
}

/** Idempotent per (account, order, reason): retries can't double-credit. */
export async function awardPoints(email: string, delta: number, reason: string, orderId: string) {
  const normalized = email.toLowerCase();
  try {
    await db.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.upsert({ where: { email: normalized }, update: {}, create: { email: normalized } });
      await tx.pointsEntry.create({ data: { accountId: account.id, delta, reason, orderId } });
      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: { increment: delta }, lifetimePoints: { increment: Math.max(delta, 0) } },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return; // already awarded
    throw error;
  }
}

/** Points for a paid order: the buyer, plus the referrer if a referral code was used. */
export async function awardOrderPoints(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { promoCode: true } });
  if (!order || order.status !== "PAID") return;
  await awardPoints(order.buyerEmail, pointsForOrder(order.total), "order", order.id);
  const referrer = order.promoCode?.referrerEmail;
  if (referrer && referrer !== order.buyerEmail) await awardPoints(referrer, REFERRAL_POINTS, "referral", order.id);
}

/** A member's personal code: friends get 10% off, the member earns points. */
export async function getOrCreateReferralCode(email: string, name: string | null) {
  const normalized = email.toLowerCase();
  const account = await db.loyaltyAccount.upsert({ where: { email: normalized }, update: {}, create: { email: normalized } });
  if (account.referralCode) return account.referralCode;

  const stem = (name ?? normalized.split("@")[0]).split(/\s+/)[0].replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toUpperCase() || "WAVE";
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `${stem}-${createTicketCode(4)}`;
    try {
      await db.$transaction([
        db.promoCode.create({ data: { code, type: "PERCENT", value: REFERRAL_DISCOUNT_PERCENT, referrerEmail: normalized } }),
        db.loyaltyAccount.update({ where: { id: account.id }, data: { referralCode: code } }),
      ]);
      return code;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  throw new Error("Couldn't create a referral code");
}
