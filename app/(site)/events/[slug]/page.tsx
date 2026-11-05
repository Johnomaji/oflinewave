import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarDays, CalendarPlus, Clock, MapPin, Shirt, ShieldAlert, Ticket, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/site/event-card";
import { Poster } from "@/components/site/poster";
import { ShareButtons } from "@/components/site/share-buttons";
import { TrackView } from "@/components/site/track-view";
import { WaitlistForm } from "@/components/site/waitlist-form";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatDateTime, formatEventDate, formatEventTime } from "@/lib/dates";
import { CATEGORY_LABELS, getEventBySlug, getRelatedEvents, type PublicEvent } from "@/lib/data/events";
import { formatPrice } from "@/lib/money";
import { getAvailability } from "@/lib/services/checkout";
import { appUrl } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Event not found" };
  const description =
    event.tagline ?? `${formatEventDate(event.startsAt)} at ${event.venue.name}, ${event.venue.city}. Get tickets on Oflinewave.`;
  return {
    title: event.title,
    description,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: { title: event.title, description, type: "website", url: `/events/${event.slug}` },
    twitter: { card: "summary_large_image", title: event.title, description },
  };
}

export default function EventPage({ params }: PageProps<"/events/[slug]">) {
  return (
    <Suspense fallback={<EventSkeleton />}>
      <EventDetail params={params} />
    </Suspense>
  );
}

async function EventDetail({ params }: { params: PageProps<"/events/[slug]">["params"] }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const url = appUrl(`/events/${event.slug}`);
  const location = `${event.venue.name}, ${event.venue.address}`;
  const faqs = Array.isArray(event.faqs) ? (event.faqs as { q: string; a: string }[]) : [];

  return (
    <article>
      <JsonLd event={event} url={url} />
      <TrackView type="event_view" eventId={event.id} />
      <div className="relative overflow-hidden">
        {/* Blurred poster wash behind the header */}
        <div className="absolute inset-0 -z-10 opacity-30 blur-3xl" aria-hidden>
          <Poster src={event.posterUrl} alt="" className="h-full w-full scale-125" sizes="10vw" />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/40 via-ink/80 to-ink" aria-hidden />

        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14 md:px-8 md:py-14">
          <div className="md:sticky md:top-24 md:self-start">
            <Poster
              src={event.posterUrl}
              alt={`${event.title} poster`}
              priority
              sizes="(min-width: 768px) 40vw, 100vw"
              className="rounded-card border border-white/10 shadow-glow"
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Badge>{CATEGORY_LABELS[event.category]}</Badge>
              {event.ageLimit && <Badge variant="outline">{event.ageLimit}+ only</Badge>}
            </div>
            <h1 className="mt-4 text-5xl font-extrabold leading-[0.9] md:text-7xl">{event.title}</h1>
            {event.tagline && <p className="mt-4 text-lg text-muted md:text-xl">{event.tagline}</p>}

            <ul className="mt-8 space-y-4">
              <InfoRow icon={CalendarDays} label="Date">
                {formatEventDate(event.startsAt)}
              </InfoRow>
              <InfoRow icon={Clock} label="Time">
                {formatEventTime(event.startsAt)}
                {event.endsAt && ` – ${formatEventTime(event.endsAt)}`}
              </InfoRow>
              <InfoRow icon={MapPin} label="Venue">
                <span className="block">{event.venue.name}</span>
                <span className="block text-sm font-normal text-muted">{event.venue.address}</span>
                <a
                  href={event.venue.mapUrl ?? `https://maps.google.com/?q=${encodeURIComponent(location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-brand hover:underline"
                >
                  Open in Maps
                </a>
              </InfoRow>
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" className="h-10">
                <a
                  href={googleCalendarUrl({
                    title: event.title,
                    description: event.tagline ?? event.title,
                    location,
                    startsAt: event.startsAt,
                    endsAt: event.endsAt,
                    url,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CalendarPlus /> Google Calendar
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-10">
                <a href={`/events/${event.slug}/calendar`} download>
                  <CalendarPlus /> Apple / Outlook
                </a>
              </Button>
            </div>
            <div className="mt-3">
              <ShareButtons url={url} title={event.title} />
            </div>

            <section id="tickets" className="mt-12 scroll-mt-24" aria-labelledby="tickets-heading">
              <h2 id="tickets-heading" className="text-3xl font-extrabold">
                Tickets
              </h2>
              <Suspense fallback={<div className="mt-5 h-64 animate-pulse rounded-card bg-surface" />}>
                <TicketsPanel event={event} />
              </Suspense>
            </section>

            <section className="mt-14" aria-labelledby="about-heading">
              <h2 id="about-heading" className="text-3xl font-extrabold">
                The night
              </h2>
              <div className="mt-4 space-y-4 text-lg leading-relaxed text-white/85">
                {event.description.split(/\n{2,}/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>

            {event.lineup.length > 0 && (
              <section className="mt-12" aria-labelledby="lineup-heading">
                <h2 id="lineup-heading" className="text-3xl font-extrabold">
                  Lineup
                </h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {event.lineup.map((name) => (
                    <li key={name} className="rounded-full border border-line bg-surface px-4 py-2 font-display font-bold">
                      {name}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(event.dressCode || event.ageLimit || event.refundPolicy) && (
              <section className="mt-12 grid gap-3 sm:grid-cols-3" aria-label="Good to know">
                {event.dressCode && <InfoCard icon={Shirt} title="Dress code" body={event.dressCode} />}
                {event.ageLimit && <InfoCard icon={ShieldAlert} title="Age" body={`${event.ageLimit}+ only. Bring valid ID.`} />}
                {event.refundPolicy && <InfoCard icon={Undo2} title="Refunds" body={event.refundPolicy} />}
              </section>
            )}

            {event.media.length > 0 && (
              <section className="mt-12" aria-labelledby="gallery-heading">
                <h2 id="gallery-heading" className="text-3xl font-extrabold">
                  Gallery
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {event.media.map((m) => (
                    <Poster key={m.id} src={m.url} alt={m.alt ?? ""} sizes="33vw" className="aspect-square rounded-xl" />
                  ))}
                </div>
              </section>
            )}

            {faqs.length > 0 && (
              <section className="mt-12" aria-labelledby="faq-heading">
                <h2 id="faq-heading" className="text-3xl font-extrabold">
                  FAQ
                </h2>
                <div className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
                  {faqs.map((f) => (
                    <details key={f.q} className="group p-5">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                        {f.q}
                        <span className="text-brand transition group-open:rotate-45" aria-hidden>
                          +
                        </span>
                      </summary>
                      <p className="mt-3 text-muted">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
      <RelatedEvents eventId={event.id} category={event.category} />
    </article>
  );
}

async function RelatedEvents({ eventId, category }: { eventId: string; category: PublicEvent["category"] }) {
  const related = await getRelatedEvents(eventId, category);
  if (related.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-5 pb-20 md:px-8" aria-labelledby="related-heading">
      <h2 id="related-heading" className="mb-6 text-3xl font-extrabold">
        More nights
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </section>
  );
}

async function TicketsPanel({ event }: { event: PublicEvent }) {
  await connection();
  const now = new Date();
  const ended = (event.endsAt ?? event.startsAt) < now;

  if (ended) {
    return (
      <div className="mt-5 rounded-card border border-line bg-surface p-6">
        <p className="font-display text-2xl font-bold">This night&apos;s a wrap.</p>
        <p className="mt-2 text-muted">Missed it? Don&apos;t miss the next one.</p>
        <Button asChild className="mt-5">
          <Link href="/events">See what&apos;s next</Link>
        </Button>
      </div>
    );
  }

  const availability = await getAvailability(event.id);
  const tiers = event.tiers.map((tier) => {
    const left = availability[tier.id] ?? 0;
    const notYet = tier.salesStart && tier.salesStart > now;
    const over = tier.salesEnd && tier.salesEnd < now;
    return { ...tier, left, notYet, over, buyable: left > 0 && !notYet && !over };
  });
  const anyBuyable = tiers.some((t) => t.buyable);
  const minPrice = tiers.filter((t) => t.buyable).reduce((m, t) => Math.min(m, t.price), Infinity);
  const checkoutHref = `/events/${event.slug}/checkout`;

  return (
    <>
      <ul className="mt-5 space-y-3">
        {tiers.map((tier) => (
          <li
            key={tier.id}
            className={`flex items-center justify-between gap-4 rounded-card border bg-surface p-5 ${tier.buyable ? "border-line" : "border-line/50 opacity-60"}`}
          >
            <div className="min-w-0">
              <p className="font-display text-lg font-bold">
                {tier.name}
                {tier.admits > 1 && <span className="ml-2 text-sm font-normal text-muted">admits {tier.admits}</span>}
                {tier.visibility === "MEMBERS" && (
                  <Badge variant="soft" className="ml-2 align-middle">
                    Wave Club
                  </Badge>
                )}
              </p>
              {tier.description && <p className="mt-1 text-sm text-muted">{tier.description}</p>}
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider">
                {tier.over ? (
                  <span className="text-muted">Sales ended</span>
                ) : tier.notYet ? (
                  <span className="text-muted">On sale {formatDateTime(tier.salesStart!)}</span>
                ) : tier.left === 0 ? (
                  <span className="text-muted">Sold out</span>
                ) : tier.left <= 20 ? (
                  <span className="text-brand">Only {tier.left} left</span>
                ) : (
                  <span className="text-success">Available</span>
                )}
              </p>
            </div>
            <p className="shrink-0 font-display text-xl font-extrabold text-brand">{formatPrice(tier.price)}</p>
          </li>
        ))}
      </ul>

      {event.addOns.length > 0 && (
        <div className="mt-4 rounded-card border border-dashed border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Extras at checkout</p>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {event.addOns.map((a) => (
              <li key={a.id} className="rounded-full bg-white/5 px-3 py-1">
                {a.name} · <span className="text-brand">{formatPrice(a.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {anyBuyable ? (
        <>
          <Button asChild size="lg" className="mt-5 w-full shadow-glow">
            <Link href={checkoutHref}>
              <Ticket /> Get tickets
            </Link>
          </Button>
          <p className="mt-3 text-center text-xs text-muted">Got an access code? Enter it at checkout.</p>
          {/* Sticky mobile CTA */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted">{minPrice === 0 ? "Free" : "From"}</p>
                <p className="font-display text-lg font-extrabold">{minPrice === 0 ? "RSVP" : formatPrice(minPrice)}</p>
              </div>
              <Button asChild size="lg" className="flex-1">
                <Link href={checkoutHref}>Get tickets</Link>
              </Button>
            </div>
          </div>
          <div className="h-20 md:hidden" aria-hidden />
        </>
      ) : (
        <div className="mt-5 rounded-card border border-brand/30 bg-brand/5 p-6">
          <p className="font-display text-2xl font-bold">Sold out. For now.</p>
          <p className="mb-5 mt-2 text-muted">Tickets sometimes free up. Join the waitlist and we&apos;ll email you first.</p>
          <WaitlistForm eventId={event.id} />
        </div>
      )}
    </>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-brand">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="font-semibold">
        <span className="sr-only">{label}: </span>
        {children}
      </div>
    </li>
  );
}

function InfoCard({ icon: Icon, title, body }: { icon: typeof MapPin; title: string; body: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <Icon className="size-5 text-brand" aria-hidden />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}

function JsonLd({ event, url }: { event: PublicEvent; url: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.tagline ?? event.description.slice(0, 200),
    startDate: event.startsAt.toISOString(),
    endDate: event.endsAt?.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: [appUrl(event.posterUrl)],
    url,
    location: {
      "@type": "Place",
      name: event.venue.name,
      address: { "@type": "PostalAddress", streetAddress: event.venue.address, addressLocality: event.venue.city, addressCountry: "NG" },
    },
    organizer: { "@type": "Organization", name: "Oflinewave", url: appUrl() },
    performer: event.lineup.map((name) => ({ "@type": "PerformingGroup", name })),
    offers: event.tiers.map((t) => ({
      "@type": "Offer",
      name: t.name,
      price: (t.price / 100).toFixed(2),
      priceCurrency: "NGN",
      url: `${url}/checkout`,
      validFrom: t.salesStart?.toISOString(),
    })),
  };
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output with < escaped is safe to inline.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

function EventSkeleton() {
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-5 py-8 md:grid-cols-[5fr_7fr] md:px-8 md:py-14" aria-hidden>
      <div className="aspect-4/5 animate-pulse rounded-card bg-surface" />
      <div className="space-y-4">
        <div className="h-6 w-24 animate-pulse rounded-full bg-surface" />
        <div className="h-20 w-3/4 animate-pulse rounded-xl bg-surface" />
        <div className="h-40 animate-pulse rounded-card bg-surface" />
      </div>
    </div>
  );
}
