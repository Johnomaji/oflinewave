import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { ipFromHeaders } from "@/lib/rate-limit";

/**
 * First-party, cookie-free analytics for the ticket funnel:
 *   event_view → checkout_view → order_created → paid
 *
 * Visitors are counted by a salted hash of IP + user agent that rotates daily,
 * so nobody can be tracked across days and no personal data is stored.
 */
export const FUNNEL_STEPS = ["event_view", "checkout_view", "order_created", "paid"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export async function visitorHash() {
  try {
    const h = await headers();
    const ip = ipFromHeaders(h);
    const ua = h.get("user-agent") ?? "";
    const day = new Date().toISOString().slice(0, 10);
    return createHash("sha256").update(`${day}:${process.env.AUTH_SECRET}:${ip}:${ua}`).digest("base64url").slice(0, 22);
  } catch {
    return null; // outside a request
  }
}

/** Record a funnel event. Never throws: analytics must not break checkout. */
export async function trackServer(
  type: FunnelStep,
  data: { eventId?: string; orderId?: string; referrer?: string | null; visitor?: string | null } = {},
) {
  try {
    let eventId = data.eventId;
    if (!eventId && data.orderId) {
      eventId = (await db.order.findUnique({ where: { id: data.orderId }, select: { eventId: true } }))?.eventId;
    }
    await db.analyticsEvent.create({
      data: {
        type,
        eventId: eventId ?? null,
        orderId: data.orderId ?? null,
        visitorHash: data.visitor ?? null,
        referrer: data.referrer?.slice(0, 200) ?? null,
      },
    });
  } catch (error) {
    console.error("[analytics] track failed", type, error);
  }
}

/** Funnel counts. Views count unique visitors; orders count orders. */
export async function getFunnel(opts: { eventId?: string; days?: number } = {}) {
  const since = new Date(Date.now() - (opts.days ?? 30) * 86_400_000);
  const where = { createdAt: { gte: since }, ...(opts.eventId ? { eventId: opts.eventId } : {}) };

  const [views, checkouts, orders, paid, referrers] = await Promise.all([
    db.analyticsEvent.findMany({ where: { ...where, type: "event_view" }, distinct: ["visitorHash"], select: { id: true } }),
    db.analyticsEvent.findMany({ where: { ...where, type: "checkout_view" }, distinct: ["visitorHash"], select: { id: true } }),
    db.analyticsEvent.count({ where: { ...where, type: "order_created" } }),
    db.analyticsEvent.count({ where: { ...where, type: "paid" } }),
    db.analyticsEvent.groupBy({
      by: ["referrer"],
      where: { ...where, type: "event_view", referrer: { not: null } },
      _count: true,
      orderBy: { _count: { referrer: "desc" } },
      take: 5,
    }),
  ]);

  return {
    steps: [
      { key: "event_view", label: "Viewed event", count: views.length },
      { key: "checkout_view", label: "Opened checkout", count: checkouts.length },
      { key: "order_created", label: "Started payment", count: orders },
      { key: "paid", label: "Paid", count: paid },
    ],
    referrers: referrers.map((r) => ({ source: r.referrer ?? "direct", count: r._count })),
  };
}
