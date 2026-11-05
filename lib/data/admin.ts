import "server-only";
import { db } from "@/lib/db";
import type { OrderStatus, Prisma } from "@/lib/generated/prisma/client";

const LIVE_TICKET: Prisma.EnumTicketStatusFilter = { in: ["VALID", "CHECKED_IN"] };

function startOfLagosDay(date = new Date()) {
  const lagos = new Date(date.getTime() + 3_600_000);
  lagos.setUTCHours(0, 0, 0, 0);
  return new Date(lagos.getTime() - 3_600_000);
}

export async function getOverview() {
  const today = startOfLagosDay();
  const [ticketsSold, revenue, todays, refunds] = await Promise.all([
    db.ticket.count({ where: { status: LIVE_TICKET } }),
    db.order.aggregate({ where: { status: "PAID" }, _sum: { total: true, fees: true } }),
    db.order.aggregate({ where: { status: "PAID", paidAt: { gte: today } }, _sum: { total: true }, _count: true }),
    db.refund.aggregate({ where: { status: { not: "FAILED" } }, _sum: { amount: true } }),
  ]);
  return {
    ticketsSold,
    grossSales: revenue._sum.total ?? 0,
    feesCollected: revenue._sum.fees ?? 0,
    todaySales: todays._sum.total ?? 0,
    todayOrders: todays._count,
    refunded: refunds._sum.amount ?? 0,
  };
}

/** Paid sales per Lagos day for the last `days` days, zero-filled. */
export async function getDailySales(days = 14, eventId?: string) {
  const since = new Date(startOfLagosDay().getTime() - (days - 1) * 86_400_000);
  const rows = await db.order.findMany({
    where: { status: "PAID", paidAt: { gte: since }, ...(eventId ? { eventId } : {}) },
    select: { paidAt: true, total: true, items: { select: { quantity: true } } },
  });
  const buckets = new Map<string, { revenue: number; tickets: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86_400_000 + 3_600_000);
    buckets.set(d.toISOString().slice(0, 10), { revenue: 0, tickets: 0 });
  }
  for (const row of rows) {
    const key = new Date(row.paidAt!.getTime() + 3_600_000).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += row.total;
    bucket.tickets += row.items.reduce((s, i) => s + i.quantity, 0);
  }
  return [...buckets].map(([date, v]) => ({ date, ...v }));
}

export async function getAdminEvents(filter?: { status?: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  const events = await db.event.findMany({
    where: filter?.status ? { status: filter.status } : undefined,
    orderBy: { startsAt: "desc" },
    include: { venue: { select: { name: true } }, tiers: { select: { quantity: true, sold: true } } },
  });
  const revenue = await db.order.groupBy({ by: ["eventId"], where: { status: "PAID" }, _sum: { total: true } });
  const revenueByEvent = new Map(revenue.map((r) => [r.eventId, r._sum.total ?? 0]));
  return events.map((e) => ({
    ...e,
    capacity: e.tiers.reduce((s, t) => s + t.quantity, 0),
    sold: e.tiers.reduce((s, t) => s + t.sold, 0),
    revenue: revenueByEvent.get(e.id) ?? 0,
  }));
}

export async function getEventReport(eventId: string) {
  const [tiers, orders, checkedIn, refunds] = await Promise.all([
    db.ticketTier.findMany({ where: { eventId }, orderBy: { sortOrder: "asc" } }),
    db.order.aggregate({ where: { eventId, status: "PAID" }, _sum: { total: true, fees: true, discount: true, subtotal: true }, _count: true }),
    db.ticket.count({ where: { eventId, status: "CHECKED_IN" } }),
    db.refund.aggregate({ where: { order: { eventId }, status: { not: "FAILED" } }, _sum: { amount: true } }),
  ]);
  const subtotal = orders._sum.subtotal ?? 0;
  const discount = orders._sum.discount ?? 0;
  const total = orders._sum.total ?? 0;
  const fees = orders._sum.fees ?? 0;
  // Payout: what the organizer keeps. When fees are passed on, total = net + fees.
  const payout = total - fees;
  return {
    tiers,
    orderCount: orders._count,
    subtotal,
    discount,
    total,
    fees,
    refunded: refunds._sum.amount ?? 0,
    payout: Math.max(payout - (refunds._sum.amount ?? 0), 0),
    checkedIn,
  };
}

export type OrderSearch = { q?: string; eventId?: string; status?: OrderStatus; page?: number };

export const ORDERS_PAGE_SIZE = 25;

export function orderSearchWhere({ q, eventId, status }: OrderSearch): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (eventId) where.eventId = eventId;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { reference: { contains: q.toUpperCase() } },
      { buyerEmail: { contains: q.toLowerCase() } },
      { buyerName: { contains: q, mode: "insensitive" } },
      { buyerPhone: { contains: q } },
      { tickets: { some: { OR: [{ code: q.toUpperCase() }, { holderName: { contains: q, mode: "insensitive" } }] } } },
    ];
  }
  return where;
}

export async function searchOrders(search: OrderSearch) {
  const where = orderSearchWhere(search);
  const page = Math.max(search.page ?? 1, 1);
  const [orders, count] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ORDERS_PAGE_SIZE,
      take: ORDERS_PAGE_SIZE,
      include: { event: { select: { title: true } }, _count: { select: { tickets: true } } },
    }),
    db.order.count({ where }),
  ]);
  return { orders, count, page, pages: Math.max(Math.ceil(count / ORDERS_PAGE_SIZE), 1) };
}

/** Published events still running or starting soon (door + check-in screens). */
export function getActiveEvents(lookbackHours: number, take: number) {
  const since = new Date(Date.now() - lookbackHours * 3_600_000);
  return db.event.findMany({
    where: { status: "PUBLISHED", OR: [{ endsAt: { gte: since } }, { endsAt: null, startsAt: { gte: since } }] },
    orderBy: { startsAt: "asc" },
    take,
    select: { id: true, title: true, startsAt: true },
  });
}
