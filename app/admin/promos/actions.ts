"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/app/admin/orders/actions";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { fromLagosInputValue } from "@/lib/dates";
import { nairaToKobo } from "@/lib/money";

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Code needs 3+ characters")
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dashes only"),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().min(0),
  eventId: z.string().optional(),
  tierIds: z.array(z.string()).default([]),
  maxUses: z.coerce.number().int().min(1).optional(),
  expiresAt: z.string().optional(),
});

export async function createPromo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const parsed = schema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    value: formData.get("value"),
    eventId: formData.get("eventId") || undefined,
    tierIds: formData.getAll("tierIds").map(String).filter(Boolean),
    maxUses: formData.get("maxUses") || undefined,
    expiresAt: formData.get("expiresAt") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  if (d.type === "PERCENT" && d.value > 100) return { error: "Percent can't exceed 100." };

  const code = d.code.toUpperCase();
  if (await db.promoCode.findUnique({ where: { code } })) return { error: "That code already exists." };

  const promo = await db.promoCode.create({
    data: {
      code,
      type: d.type,
      value: d.type === "PERCENT" ? Math.round(d.value) : nairaToKobo(d.value),
      eventId: d.eventId ?? null,
      tierIds: d.tierIds,
      maxUses: d.maxUses ?? null,
      expiresAt: d.expiresAt ? fromLagosInputValue(d.expiresAt) : null,
    },
  });
  await audit(user.id, "promo.created", "PromoCode", promo.id, { code });
  revalidatePath("/admin/promos");
  return { ok: `${code} is live.` };
}

export async function togglePromo(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get("id"));
  const promo = await db.promoCode.update({ where: { id }, data: { active: formData.get("active") === "true" } });
  await audit(user.id, promo.active ? "promo.enabled" : "promo.disabled", "PromoCode", id);
  revalidatePath("/admin/promos");
}
