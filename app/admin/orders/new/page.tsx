import { Suspense } from "react";
import { ManualOrderForm } from "@/components/admin/manual-order-form";
import { AdminSkeleton, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";

export const metadata = { title: "Add attendee" };

export default function NewOrderPage({ searchParams }: PageProps<"/admin/orders/new">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <NewOrder searchParams={searchParams} />
    </Suspense>
  );
}

async function NewOrder({ searchParams }: Pick<PageProps<"/admin/orders/new">, "searchParams">) {
  await requireAdmin("/admin/orders/new");
  const sp = await searchParams;
  const events = await db.event.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { startsAt: "desc" },
    select: { id: true, title: true, tiers: { select: { id: true, name: true, price: true }, orderBy: { sortOrder: "asc" } } },
  });
  return (
    <div className="max-w-2xl">
      <PageHeader title="Add attendee" description="Guest list comps and cash sales at the door. Tickets issue instantly." />
      <ManualOrderForm events={events} defaultEventId={typeof sp.event === "string" ? sp.event : undefined} />
    </div>
  );
}
