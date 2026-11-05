"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { CheckoutError, findUsablePromo, getAvailability } from "@/lib/services/checkout";
import type { DiscountType } from "@/lib/generated/prisma/enums";

export type HiddenTier = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  minPerOrder: number;
  maxPerOrder: number;
  admits: number;
  left: number;
};

export type ApplyCodeResult =
  | { ok: true; promo: { code: string; type: DiscountType; value: number; tierIds: string[] }; unlocked: HiddenTier[] }
  | { ok: false; error: string };

const schema = z.object({ eventId: z.string().min(1).max(40), code: z.string().trim().min(2).max(40) });

/** Validates a promo/access code and reveals any code-only tiers it unlocks. */
export async function applyCode(eventId: string, code: string): Promise<ApplyCodeResult> {
  const parsed = schema.safeParse({ eventId, code });
  if (!parsed.success) return { ok: false, error: "Enter a code." };
  if (!rateLimit(`promo:${await clientIp()}`, 10, 60_000).ok) {
    return { ok: false, error: "Too many attempts. Try again in a minute." };
  }

  try {
    const promo = await findUsablePromo(db, parsed.data.code, parsed.data.eventId);
    const hidden = promo.tierIds.length
      ? await db.ticketTier.findMany({
          where: { id: { in: promo.tierIds }, eventId: parsed.data.eventId, visibility: "HIDDEN" },
          orderBy: { sortOrder: "asc" },
        })
      : [];
    const availability = hidden.length ? await getAvailability(parsed.data.eventId) : {};
    return {
      ok: true,
      promo: { code: promo.code, type: promo.type, value: promo.value, tierIds: promo.tierIds },
      unlocked: hidden.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        price: t.price,
        minPerOrder: t.minPerOrder,
        maxPerOrder: t.maxPerOrder,
        admits: t.admits,
        left: availability[t.id] ?? 0,
      })),
    };
  } catch (error) {
    if (error instanceof CheckoutError) return { ok: false, error: error.message };
    throw error;
  }
}
