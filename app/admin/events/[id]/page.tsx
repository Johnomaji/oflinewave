import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Download, ExternalLink, Receipt, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifyWaitlistAction } from "@/app/admin/events/actions";
import { ActionForm } from "@/components/admin/action-form";
import { EventForm } from "@/components/admin/event-form";
import { FunnelCard } from "@/components/admin/funnel-card";
import { SalesChart } from "@/components/admin/sales-chart";
import { AdminSkeleton, EventStatusBadge, PageHeader, ProgressBar, StatCard, TableWrap, td, th } from "@/components/admin/ui";
import { toLagosInputValue } from "@/lib/dates";
import { getFunnel } from "@/lib/analytics";
import { getDailySales, getEventReport } from "@/lib/data/admin";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";

export const metadata = { title: "Edit event" };

export default function EditEventPage({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <EditEvent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditEvent({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/events/${id}`);
  const sp = await searchParams;

  const event = await db.event.findUnique({
    where: { id },
    include: { tiers: { orderBy: { sortOrder: "asc" } }, addOns: { orderBy: { sortOrder: "asc" } } },
  });
  if (!event) notFound();

  const [venues, report, daily, waitlist, waitlistPending, funnel] = await Promise.all([
    db.venue.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, city: true } }),
    getEventReport(id),
    getDailySales(21, id),
    db.waitlistEntry.count({ where: { eventId: id } }),
    db.waitlistEntry.count({ where: { eventId: id, notifiedAt: null } }),
    getFunnel({ eventId: id, days: 90 }),
  ]);
  const live = report.tiers.reduce((s, t) => s + t.sold, 0);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={event.title}
        description={`/events/${event.slug}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/events/${event.slug}`} target="_blank">
                <ExternalLink /> View
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/orders?event=${event.id}`}>
                <Receipt /> Orders
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/orders/new?event=${event.id}`}>
                <UserPlus /> Add attendee
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/admin/orders-csv?event=${event.id}`}>
                <Download /> CSV
              </a>
            </Button>
          </>
        }
      />
      {sp.saved && (
        <p role="status" className="mb-6 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">
          Saved. Public pages update right away.
        </p>
      )}

      <div className="mb-3 flex items-center gap-3">
        <EventStatusBadge status={event.status} />
        {waitlist > 0 && <span className="text-sm text-muted">{waitlist} on the waitlist</span>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tickets sold" value={live.toLocaleString("en-NG")} hint={`${report.orderCount} paid orders`} />
        <StatCard label="Gross sales" value={formatNaira(report.total)} hint={report.discount ? `${formatNaira(report.discount)} in discounts` : undefined} />
        <StatCard label="Fees" value={formatNaira(report.fees)} hint={report.refunded ? `${formatNaira(report.refunded)} refunded` : undefined} />
        <StatCard label="Payout" value={formatNaira(report.payout)} accent />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SalesChart data={daily} />
        <TableWrap>
          <table className="w-full text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className={th}>Tier</th>
                <th className={th}>Price</th>
                <th className={th}>Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {report.tiers.map((t) => (
                <tr key={t.id}>
                  <td className={td}>
                    {t.name}
                    {t.visibility === "HIDDEN" && <span className="ml-2 text-xs text-muted">hidden</span>}
                  </td>
                  <td className={td}>{t.price === 0 ? "Free" : formatNaira(t.price)}</td>
                  <td className={`${td} w-40`}>
                    <p className="mb-1 text-xs">
                      {t.sold} / {t.quantity}
                    </p>
                    <ProgressBar value={t.sold} max={t.quantity} label={`${t.name} sold`} />
                  </td>
                </tr>
              ))}
              <tr>
                <td className={`${td} text-muted`} colSpan={2}>
                  Checked in
                </td>
                <td className={td}>
                  {report.checkedIn} / {live}
                </td>
              </tr>
            </tbody>
          </table>
        </TableWrap>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <FunnelCard funnel={funnel} title="Funnel, last 90 days" />
        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-bold">Waitlist</h2>
          <p className="mt-1 text-sm text-muted">
            {waitlist} signed up · {waitlistPending} not yet emailed. People are emailed automatically when refunds free up seats or you add capacity.
          </p>
          {event.addOns.length > 0 && (
            <p className="mt-4 text-sm text-muted">
              Add-ons sold: {event.addOns.map((a) => `${a.name} ${a.sold}/${a.quantity}`).join(" · ")}
            </p>
          )}
          {waitlistPending > 0 && (
            <div className="mt-4">
              <ActionForm action={notifyWaitlistAction} fields={{ eventId: event.id }} label="Email the waitlist now" pendingLabel="Sending…" />
            </div>
          )}
        </div>
      </div>

      <h2 className="mb-4 mt-12 text-2xl font-bold">Edit</h2>
      <EventForm
        venues={venues}
        soldByTier={Object.fromEntries(event.tiers.map((t) => [t.id, t.sold]))}
        initial={{
          id: event.id,
          title: event.title,
          slug: event.slug,
          tagline: event.tagline ?? "",
          description: event.description,
          category: event.category,
          status: event.status,
          listed: event.listed,
          featured: event.featured,
          startsAt: toLagosInputValue(event.startsAt),
          endsAt: toLagosInputValue(event.endsAt),
          venueId: event.venueId,
          posterUrl: event.posterUrl,
          lineup: event.lineup,
          ageLimit: event.ageLimit,
          dressCode: event.dressCode ?? "",
          refundPolicy: event.refundPolicy ?? "",
          faqs: Array.isArray(event.faqs) ? (event.faqs as { q: string; a: string }[]) : [],
          feeMode: event.feeMode ?? "DEFAULT",
          collectAttendeeNames: event.collectAttendeeNames,
          transfersEnabled: event.transfersEnabled,
          transferCutoffHours: event.transferCutoffHours,
          addOns: event.addOns.map((a) => ({
            id: a.id,
            name: a.name,
            description: a.description ?? "",
            priceNaira: a.price / 100,
            quantity: a.quantity,
            maxPerOrder: a.maxPerOrder,
            active: a.active,
          })),
          tiers: event.tiers.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description ?? "",
            priceNaira: t.price / 100,
            quantity: t.quantity,
            minPerOrder: t.minPerOrder,
            maxPerOrder: t.maxPerOrder,
            admits: t.admits,
            salesStart: toLagosInputValue(t.salesStart),
            salesEnd: toLagosInputValue(t.salesEnd),
            visibility: t.visibility,
          })),
        }}
      />
    </div>
  );
}
