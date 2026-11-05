import Link from "next/link";
import { Suspense } from "react";
import { Download, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { AdminSkeleton, OrderStatusBadge, PageHeader, TableWrap, td, th } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/dates";
import { searchOrders } from "@/lib/data/admin";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { formatNaira } from "@/lib/money";

export const metadata = { title: "Orders" };

const STATUSES: OrderStatus[] = ["PAID", "PENDING", "FAILED", "REFUNDED", "CANCELLED"];

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}

async function Orders({ searchParams }: Pick<PageProps<"/admin/orders">, "searchParams">) {
  await requireAdmin("/admin/orders");
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const status = STATUSES.find((s) => s === str(sp.status));
  const search = { q: str(sp.q)?.slice(0, 100), eventId: str(sp.event), status, page: Number(str(sp.page) ?? 1) || 1 };

  const [{ orders, count, page, pages }, events] = await Promise.all([
    searchOrders(search),
    db.event.findMany({ orderBy: { startsAt: "desc" }, select: { id: true, title: true } }),
  ]);

  const query = (extra: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: search.q, event: search.eventId, status: search.status, ...extra })) {
      if (v !== undefined && v !== "") params.set(k, String(v));
    }
    return params.toString();
  };

  return (
    <>
      <PageHeader
        title="Orders & attendees"
        description={`${count.toLocaleString("en-NG")} orders`}
        actions={
          <>
            <Button asChild variant="outline">
              <a href={`/api/admin/orders-csv?${query({})}`}>
                <Download /> Export CSV
              </a>
            </Button>
            <Button asChild>
              <Link href={`/admin/orders/new${search.eventId ? `?event=${search.eventId}` : ""}`}>
                <UserPlus /> Add attendee
              </Link>
            </Button>
          </>
        }
      />

      <form method="get" className="mb-6 grid gap-3 md:grid-cols-[2fr_1.5fr_1fr_auto]" role="search">
        <div className="relative">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input id="q" name="q" defaultValue={search.q} placeholder="Name, email, phone, order ref or ticket code" className="pl-11" />
        </div>
        <label htmlFor="event" className="sr-only">
          Event
        </label>
        <Select id="event" name="event" defaultValue={search.eventId ?? ""}>
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </Select>
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <Select id="status" name="status" defaultValue={search.status ?? ""}>
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </Select>
        <Button type="submit" className="h-12">
          Search
        </Button>
      </form>

      <TableWrap>
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line">
            <tr>
              <th className={th}>Order</th>
              <th className={th}>Buyer</th>
              <th className={th}>Event</th>
              <th className={th}>Tickets</th>
              <th className={th}>Total</th>
              <th className={th}>Status</th>
              <th className={th}>Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-white/[0.02]">
                <td className={td}>
                  <Link href={`/admin/orders/${o.id}`} className="font-mono font-semibold hover:text-brand">
                    {o.reference}
                  </Link>
                  {o.source !== "ONLINE" && <p className="text-xs text-muted">{o.source.toLowerCase()}</p>}
                </td>
                <td className={td}>
                  <p className="font-medium">{o.buyerName}</p>
                  <p className="text-xs text-muted">{o.buyerEmail}</p>
                </td>
                <td className={`${td} text-muted`}>{o.event.title}</td>
                <td className={td}>{o._count.tickets}</td>
                <td className={`${td} font-semibold`}>{o.total === 0 ? "Free" : formatNaira(o.total)}</td>
                <td className={td}>
                  <OrderStatusBadge status={o.status} />
                </td>
                <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(o.paidAt ?? o.createdAt)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted">
                  No orders match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/orders?${query({ page: page - 1 })}`}>Previous</Link>
              </Button>
            )}
            {page < pages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/orders?${query({ page: page + 1 })}`}>Next</Link>
              </Button>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
