import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { CheckoutForm } from "@/components/site/checkout-form";
import { TrackView } from "@/components/site/track-view";
import { formatEventDate, formatEventTime } from "@/lib/dates";
import { getEventBySlug } from "@/lib/data/events";
import { getCurrentUser } from "@/lib/dal";
import { HOLD_MINUTES, getAddOnAvailability, getAvailability } from "@/lib/services/checkout";
import { isMember } from "@/lib/services/loyalty";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage({ params }: PageProps<"/events/[slug]/checkout">) {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12">
      <Suspense fallback={<div className="h-[60vh] animate-pulse rounded-card bg-surface" />}>
        <Checkout params={params} />
      </Suspense>
    </div>
  );
}

async function Checkout({ params }: { params: PageProps<"/events/[slug]/checkout">["params"] }) {
  const { slug } = await params;
  await connection();
  const event = await getEventBySlug(slug);
  if (!event || event.status !== "PUBLISHED") notFound();

  const now = new Date();
  if ((event.endsAt ?? event.startsAt) < now) notFound();

  const [availability, addOnAvailability, settings, user] = await Promise.all([
    getAvailability(event.id),
    getAddOnAvailability(event.id),
    getSettings(),
    getCurrentUser(),
  ]);
  const member = await isMember(user?.email);

  const tiers = event.tiers.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    price: t.price,
    minPerOrder: t.minPerOrder,
    maxPerOrder: t.maxPerOrder,
    admits: t.admits,
    left: availability[t.id] ?? 0,
    onSale: !(t.salesStart && t.salesStart > now) && !(t.salesEnd && t.salesEnd < now),
    membersOnly: t.visibility === "MEMBERS",
    locked: t.visibility === "MEMBERS" && !member,
    offSaleLabel: t.salesEnd && t.salesEnd < now ? "Sales ended" : t.salesStart && t.salesStart > now ? "Not on sale yet" : null,
  }));

  return (
    <>
      <TrackView type="checkout_view" eventId={event.id} />
      <Link href={`/events/${event.slug}`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-white">
        <ArrowLeft className="size-4" /> Back to event
      </Link>
      <h1 className="mt-4 text-4xl font-extrabold leading-[0.95] md:text-6xl">{event.title}</h1>
      <p className="mt-2 text-muted">
        {formatEventDate(event.startsAt)} · {formatEventTime(event.startsAt)} · {event.venue.name}
      </p>
      <CheckoutForm
        eventId={event.id}
        tiers={tiers}
        addOns={event.addOns.map((a) => ({ ...a, left: addOnAvailability[a.id] ?? 0 }))}
        signInHref={`/login?next=${encodeURIComponent(`/events/${event.slug}/checkout`)}`}
        signedIn={Boolean(user)}
        collectAttendeeNames={event.collectAttendeeNames}
        feeRule={{
          feePercentBps: settings.feePercentBps,
          feeFlat: settings.feeFlat,
          feeMode: event.feeMode ?? settings.defaultFeeMode,
        }}
        holdMinutes={HOLD_MINUTES}
        ageLimit={event.ageLimit}
        prefill={{ name: user?.name ?? "", email: user?.email ?? "" }}
      />
    </>
  );
}
