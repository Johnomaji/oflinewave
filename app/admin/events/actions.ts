"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/app/admin/orders/actions";
import { audit } from "@/lib/audit";
import { defer } from "@/lib/defer";
import { notifyWaitlist } from "@/lib/services/waitlist";
import { requireAdmin } from "@/lib/dal";
import { EVENTS_TAG, eventTag } from "@/lib/data/events";
import { db } from "@/lib/db";
import { fromLagosInputValue } from "@/lib/dates";
import { nairaToKobo } from "@/lib/money";
import { eventInputSchema, type EventInput } from "@/lib/validation-admin";

export type SaveEventResult = { error: string; field?: string } | undefined;

function invalidate(...slugs: string[]) {
  updateTag(EVENTS_TAG);
  for (const slug of slugs) updateTag(eventTag(slug));
}

export async function saveEvent(input: EventInput): Promise<SaveEventResult> {
  const user = await requireAdmin();
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: issue.path.join(".") };
  }
  const data = parsed.data;

  const clash = await db.event.findFirst({ where: { slug: data.slug, NOT: data.id ? { id: data.id } : undefined } });
  if (clash) return { error: "Another event already uses that URL slug.", field: "slug" };

  let venueId = data.venueId;
  if (!venueId && data.newVenue) {
    const venue = await db.venue.create({ data: { ...data.newVenue, mapUrl: data.newVenue.mapUrl || null } });
    venueId = venue.id;
  }
  if (!venueId) return { error: "Pick or add a venue.", field: "venueId" };

  const startsAt = fromLagosInputValue(data.startsAt);
  const endsAt = data.endsAt ? fromLagosInputValue(data.endsAt) : null;
  if (endsAt && endsAt <= startsAt) return { error: "End time must be after the start.", field: "endsAt" };

  const fields = {
    title: data.title,
    slug: data.slug,
    tagline: data.tagline || null,
    description: data.description,
    category: data.category,
    status: data.status,
    listed: data.listed,
    featured: data.featured,
    startsAt,
    endsAt,
    venueId,
    posterUrl: data.posterUrl,
    lineup: data.lineup,
    ageLimit: data.ageLimit,
    dressCode: data.dressCode || null,
    refundPolicy: data.refundPolicy || null,
    faqs: data.faqs,
    feeMode: data.feeMode === "DEFAULT" ? null : data.feeMode,
    collectAttendeeNames: data.collectAttendeeNames,
    transfersEnabled: data.transfersEnabled,
    transferCutoffHours: data.transferCutoffHours,
  };

  const addOnData = (a: (typeof data.addOns)[number], index: number) => ({
    name: a.name,
    description: a.description || null,
    price: nairaToKobo(a.priceNaira),
    quantity: a.quantity,
    maxPerOrder: a.maxPerOrder,
    active: a.active,
    sortOrder: index,
  });

  const tierData = (t: (typeof data.tiers)[number], index: number) => ({
    name: t.name,
    description: t.description || null,
    price: nairaToKobo(t.priceNaira),
    quantity: t.quantity,
    minPerOrder: t.minPerOrder,
    maxPerOrder: t.maxPerOrder,
    admits: t.admits,
    salesStart: t.salesStart ? fromLagosInputValue(t.salesStart) : null,
    salesEnd: t.salesEnd ? fromLagosInputValue(t.salesEnd) : null,
    visibility: t.visibility,
    sortOrder: index,
  });

  let eventId = data.id;
  let previousSlug: string | null = null;

  try {
    if (!eventId) {
      const created = await db.event.create({
        data: { ...fields, tiers: { create: data.tiers.map(tierData) }, addOns: { create: data.addOns.map(addOnData) } },
      });
      eventId = created.id;
      await audit(user.id, "event.created", "Event", eventId, { title: data.title });
    } else {
      const id = eventId;
      await db.$transaction(async (tx) => {
        const existing = await tx.event.findUniqueOrThrow({ where: { id }, include: { tiers: { include: { _count: { select: { orderItems: true } } } } } });
        previousSlug = existing.slug;
        const keepIds = new Set(data.tiers.map((t) => t.id).filter(Boolean));

        for (const tier of existing.tiers) {
          if (keepIds.has(tier.id)) continue;
          if (tier._count.orderItems > 0) throw new Error(`"${tier.name}" has orders, so it can't be removed. Set its quantity to what's sold instead.`);
          await tx.ticketTier.delete({ where: { id: tier.id } });
        }

        for (const [index, t] of data.tiers.entries()) {
          const existingTier = existing.tiers.find((et) => et.id === t.id);
          if (existingTier) {
            if (t.quantity < existingTier.sold) throw new Error(`"${t.name}" already sold ${existingTier.sold}. Quantity can't go lower.`);
            await tx.ticketTier.update({ where: { id: existingTier.id }, data: tierData(t, index) });
          } else {
            await tx.ticketTier.create({ data: { ...tierData(t, index), eventId: id } });
          }
        }
        // Add-ons: sold ones are deactivated rather than deleted.
        const existingAddOns = await tx.addOn.findMany({ where: { eventId: id }, include: { _count: { select: { orders: true } } } });
        const keepAddOns = new Set(data.addOns.map((a) => a.id).filter(Boolean));
        for (const addOn of existingAddOns) {
          if (keepAddOns.has(addOn.id)) continue;
          if (addOn._count.orders > 0) await tx.addOn.update({ where: { id: addOn.id }, data: { active: false } });
          else await tx.addOn.delete({ where: { id: addOn.id } });
        }
        for (const [index, a] of data.addOns.entries()) {
          const existing = existingAddOns.find((e) => e.id === a.id);
          if (existing) {
            if (a.quantity < existing.sold) throw new Error(`"${a.name}" already sold ${existing.sold}. Quantity can't go lower.`);
            await tx.addOn.update({ where: { id: existing.id }, data: addOnData(a, index) });
          } else {
            await tx.addOn.create({ data: { ...addOnData(a, index), eventId: id } });
          }
        }
        await tx.event.update({ where: { id }, data: fields });
      });
      await audit(user.id, "event.updated", "Event", eventId, { title: data.title, status: data.status });
      // More capacity or a re-opened tier may free seats for the waitlist.
      const updatedId = eventId;
      defer(() => notifyWaitlist(updatedId, user.id));
    }
  } catch (error) {
    if (error instanceof Error && !("code" in error)) return { error: error.message };
    throw error;
  }

  invalidate(data.slug, ...(previousSlug && previousSlug !== data.slug ? [previousSlug] : []));
  redirect(`/admin/events/${eventId}?saved=1`);
}

/** Copies an event and its tiers as a fresh draft (no sales, no media). */
export async function duplicateEvent(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get("id"));
  const source = await db.event.findUniqueOrThrow({ where: { id }, include: { tiers: true, addOns: true } });

  let slug = `${source.slug}-copy`;
  for (let n = 2; await db.event.findUnique({ where: { slug } }); n++) slug = `${source.slug}-copy-${n}`;

  const copy = await db.event.create({
    data: {
      slug,
      title: `${source.title} (copy)`,
      tagline: source.tagline,
      description: source.description,
      category: source.category,
      status: "DRAFT",
      listed: source.listed,
      startsAt: source.startsAt,
      endsAt: source.endsAt,
      venueId: source.venueId,
      posterUrl: source.posterUrl,
      lineup: source.lineup,
      ageLimit: source.ageLimit,
      dressCode: source.dressCode,
      refundPolicy: source.refundPolicy,
      faqs: source.faqs ?? undefined,
      feeMode: source.feeMode,
      collectAttendeeNames: source.collectAttendeeNames,
      transfersEnabled: source.transfersEnabled,
      transferCutoffHours: source.transferCutoffHours,
      addOns: {
        create: source.addOns.map(({ name, description, price, quantity, maxPerOrder, active, sortOrder }) => ({
          name,
          description,
          price,
          quantity,
          maxPerOrder,
          active,
          sortOrder,
        })),
      },
      tiers: {
        create: source.tiers.map(({ name, description, price, quantity, minPerOrder, maxPerOrder, admits, visibility, sortOrder }) => ({
          name,
          description,
          price,
          quantity,
          minPerOrder,
          maxPerOrder,
          admits,
          visibility,
          sortOrder,
        })),
      },
    },
  });
  await audit(user.id, "event.duplicated", "Event", copy.id, { from: id });
  redirect(`/admin/events/${copy.id}`);
}

export async function notifyWaitlistAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const result = await notifyWaitlist(String(formData.get("eventId")), user.id);
  if (result.sent === 0) return { error: result.reason ?? "Nobody was emailed." };
  return { ok: `Emailed ${result.sent} ${result.sent === 1 ? "person" : "people"}.` };
}
