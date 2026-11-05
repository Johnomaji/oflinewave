import { Suspense } from "react";
import { EventForm } from "@/components/admin/event-form";
import { AdminSkeleton, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { emptyTier } from "@/lib/validation-admin";

export const metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <NewEvent />
    </Suspense>
  );
}

async function NewEvent() {
  await requireAdmin("/admin/events/new");
  const venues = await db.venue.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, city: true } });
  return (
    <div className="max-w-5xl">
      <PageHeader title="New event" description="Save as a draft, publish when it's ready." />
      <EventForm
        venues={venues}
        initial={{
          title: "",
          slug: "",
          description: "",
          category: "PARTY",
          status: "DRAFT",
          listed: true,
          featured: false,
          startsAt: "",
          posterUrl: "",
          lineup: [],
          ageLimit: 18,
          faqs: [],
          feeMode: "DEFAULT",
          collectAttendeeNames: false,
          transfersEnabled: true,
          transferCutoffHours: 24,
          addOns: [],
          tiers: [{ ...emptyTier(), name: "Early Bird" }, { ...emptyTier(), name: "Regular" }],
        }}
      />
    </div>
  );
}
