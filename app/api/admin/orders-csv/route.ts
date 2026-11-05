import { orderSearchWhere } from "@/lib/data/admin";
import { getCurrentUser, isAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

const STATUSES: OrderStatus[] = ["PAID", "PENDING", "FAILED", "REFUNDED", "CANCELLED"];

function csvCell(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** One row per ticket (attendee list) with its order context. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return new Response("Forbidden", { status: 403 });

  const sp = new URL(request.url).searchParams;
  const status = STATUSES.find((s) => s === sp.get("status"));
  const where = orderSearchWhere({ q: sp.get("q") ?? undefined, eventId: sp.get("event") ?? undefined, status });

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { event: { select: { title: true } }, tickets: { include: { tier: { select: { name: true } } } } },
  });

  const header = ["order_ref", "event", "order_status", "source", "buyer_name", "buyer_email", "buyer_phone", "order_total_ngn", "paid_at", "ticket_code", "tier", "holder_name", "ticket_status", "checked_in_at"];
  const rows = orders.flatMap((o) => {
    const base = [o.reference, o.event.title, o.status, o.source, o.buyerName, o.buyerEmail, o.buyerPhone, (o.total / 100).toFixed(2), o.paidAt?.toISOString()];
    if (o.tickets.length === 0) return [[...base, "", "", "", "", ""]];
    return o.tickets.map((t) => [...base, t.code, t.tier.name, t.holderName, t.status, t.checkedInAt?.toISOString()]);
  });

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="oflinewave-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
