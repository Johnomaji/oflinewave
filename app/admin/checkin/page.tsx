import Link from "next/link";
import { Suspense } from "react";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PendingRefresher } from "@/components/site/pending-refresher";
import { AdminSkeleton, PageHeader, ProgressBar } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/dates";
import { getActiveEvents } from "@/lib/data/admin";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";

export const metadata = { title: "Check-in" };

export default function CheckinPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Checkin />
    </Suspense>
  );
}

async function Checkin() {
  await requireAdmin("/admin/checkin");
  const events = await getActiveEvents(48, 6);
  const counts = await db.ticket.groupBy({
    by: ["eventId", "status"],
    where: { eventId: { in: events.map((e) => e.id) }, status: { in: ["VALID", "CHECKED_IN"] } },
    _count: true,
  });
  const recent = await db.ticket.findMany({
    where: { eventId: { in: events.map((e) => e.id) }, status: "CHECKED_IN" },
    orderBy: { checkedInAt: "desc" },
    take: 12,
    include: { tier: { select: { name: true } }, checkedInBy: { select: { name: true, email: true } }, event: { select: { title: true } } },
  });

  return (
    <>
      {/* Live: refresh every 5s */}
      <PendingRefresher intervalMs={5000} maxTries={2000} />
      <PageHeader
        title="Check-in"
        description="Live door count. Updates every few seconds."
        actions={
          <Button asChild>
            <Link href="/scan">
              <ScanLine /> Open scanner
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {events.map((e) => {
          const checkedIn = counts.find((c) => c.eventId === e.id && c.status === "CHECKED_IN")?._count ?? 0;
          const valid = counts.find((c) => c.eventId === e.id && c.status === "VALID")?._count ?? 0;
          const total = checkedIn + valid;
          return (
            <div key={e.id} className="rounded-card border border-line bg-surface p-6">
              <p className="font-display text-xl font-bold">{e.title}</p>
              <p className="text-sm text-muted">{formatDateTime(e.startsAt)}</p>
              <p className="mt-6 font-display text-5xl font-extrabold" aria-live="polite">
                {checkedIn}
                <span className="text-2xl text-muted"> / {total}</span>
              </p>
              <p className="mb-3 text-sm text-muted">checked in ({total ? Math.round((checkedIn / total) * 100) : 0}%)</p>
              <ProgressBar value={checkedIn} max={total} label={`${e.title} check-in`} />
            </div>
          );
        })}
        {events.length === 0 && <p className="text-muted">No events in the next few days.</p>}
      </div>
      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-bold">Latest scans</h2>
          <ul className="divide-y divide-line rounded-card border border-line bg-surface text-sm">
            {recent.map((t) => (
              <li key={t.id} className="flex justify-between gap-4 p-3">
                <span>
                  <strong>{t.holderName}</strong> · {t.tier.name} <span className="text-muted">({t.event.title})</span>
                </span>
                <span className="shrink-0 text-muted">
                  {t.checkedInAt && formatDateTime(t.checkedInAt)} · {t.checkedInBy?.name ?? t.checkedInBy?.email ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
