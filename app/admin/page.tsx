import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FunnelCard } from "@/components/admin/funnel-card";
import { SalesChart } from "@/components/admin/sales-chart";
import { AdminSkeleton, EventStatusBadge, PageHeader, ProgressBar, StatCard } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/dates";
import { getFunnel } from "@/lib/analytics";
import { getAdminEvents, getDailySales, getOverview } from "@/lib/data/admin";
import { requireAdmin } from "@/lib/dal";
import { formatNaira } from "@/lib/money";

export const metadata = { title: "Overview" };

export default function AdminHome() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  await requireAdmin("/admin");
  const [stats, daily, events, funnel] = await Promise.all([getOverview(), getDailySales(14), getAdminEvents(), getFunnel({ days: 30 })]);
  const now = new Date();
  const upcoming = events.filter((e) => (e.endsAt ?? e.startsAt) >= now && e.status !== "ARCHIVED").reverse();

  return (
    <>
      <PageHeader
        title="Tonight's numbers"
        description="Every ticket, every naira."
        actions={
          <Button asChild>
            <Link href="/admin/events/new">
              <Plus /> New event
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today" value={formatNaira(stats.todaySales)} hint={`${stats.todayOrders} orders`} accent />
        <StatCard label="Tickets sold" value={stats.ticketsSold.toLocaleString("en-NG")} hint="All events, live tickets" />
        <StatCard label="Gross sales" value={formatNaira(stats.grossSales)} hint={`${formatNaira(stats.refunded)} refunded`} />
        <StatCard label="Fees collected" value={formatNaira(stats.feesCollected)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <SalesChart data={daily} />
        <FunnelCard funnel={funnel} title="Funnel, last 30 days" />
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-2xl font-bold">Upcoming events</h2>
        {upcoming.length === 0 ? (
          <p className="text-muted">Nothing on the calendar. Time to throw something.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {upcoming.map((e) => (
              <li key={e.id}>
                <Link href={`/admin/events/${e.id}`} className="block rounded-card border border-line bg-surface p-5 transition hover:border-brand/50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-bold">{e.title}</p>
                      <p className="text-sm text-muted">
                        {formatDateTime(e.startsAt)} · {e.venue.name}
                      </p>
                    </div>
                    <EventStatusBadge status={e.status} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span>
                      {e.sold} / {e.capacity} sold
                    </span>
                    <span className="font-semibold text-brand">{formatNaira(e.revenue)}</span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={e.sold} max={e.capacity} label={`${e.title} sell-through`} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
