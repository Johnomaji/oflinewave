import Link from "next/link";
import { Suspense } from "react";
import { Copy, Plus } from "lucide-react";
import { duplicateEvent } from "@/app/admin/events/actions";
import { Button } from "@/components/ui/button";
import { AdminSkeleton, EventStatusBadge, PageHeader, ProgressBar, TableWrap, td, th } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/dates";
import { getAdminEvents } from "@/lib/data/admin";
import { requireAdmin } from "@/lib/dal";
import { formatNaira } from "@/lib/money";

export const metadata = { title: "Events" };

export default function AdminEventsPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <EventsTable />
    </Suspense>
  );
}

async function EventsTable() {
  await requireAdmin("/admin/events");
  const events = await getAdminEvents();

  return (
    <>
      <PageHeader
        title="Events"
        description="Drafts, live drops and the archive."
        actions={
          <Button asChild>
            <Link href="/admin/events/new">
              <Plus /> New event
            </Link>
          </Button>
        }
      />
      <TableWrap>
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line">
            <tr>
              <th className={th}>Event</th>
              <th className={th}>Date</th>
              <th className={th}>Status</th>
              <th className={th}>Sold</th>
              <th className={th}>Revenue</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-white/[0.02]">
                <td className={td}>
                  <Link href={`/admin/events/${e.id}`} className="font-semibold hover:text-brand">
                    {e.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {e.venue.name}
                    {!e.listed && " · unlisted"}
                    {e.featured && " · featured"}
                  </p>
                </td>
                <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(e.startsAt)}</td>
                <td className={td}>
                  <EventStatusBadge status={e.status} />
                </td>
                <td className={`${td} w-40`}>
                  <p className="mb-1 text-xs">
                    {e.sold} / {e.capacity}
                  </p>
                  <ProgressBar value={e.sold} max={e.capacity} label={`${e.title} sold`} />
                </td>
                <td className={`${td} font-semibold`}>{formatNaira(e.revenue)}</td>
                <td className={`${td} text-right`}>
                  <form action={duplicateEvent}>
                    <input type="hidden" name="id" value={e.id} />
                    <Button variant="ghost" size="sm" aria-label={`Duplicate ${e.title}`}>
                      <Copy /> Duplicate
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </>
  );
}
