import { ArrowRight, CalendarDays, MapPin, QrCode, Smartphone, Ticket } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/site/event-card";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { Poster } from "@/components/site/poster";
import { Reveal } from "@/components/site/reveal";
import { Glow, WaveDivider, WaveLine } from "@/components/site/wave";
import { formatEventDate, formatEventTime } from "@/lib/dates";
import { fromPrice, getFeaturedEvent, getPastEvents, getUpcomingEvents, isSoldOut } from "@/lib/data/events";
import { formatPrice } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export default async function HomePage() {
  const [featured, upcoming, past, settings] = await Promise.all([
    getFeaturedEvent(),
    getUpcomingEvents(7),
    getPastEvents(8),
    getSettings(),
  ]);
  const rest = upcoming.filter((e) => e.id !== featured?.id).slice(0, 6);

  return (
    <>
      <Hero featured={featured} />

      {rest.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28" aria-labelledby="upcoming-heading">
          <SectionHeading id="upcoming-heading" eyebrow="Coming up" title="Your next night starts here." href="/events" cta="All events" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((event, i) => (
              <Reveal key={event.id} delay={i * 0.06}>
                <EventCard event={event} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <HowItWorks />

      {past.length > 0 && (
        <section className="py-20 md:py-28" aria-labelledby="past-heading">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <SectionHeading id="past-heading" eyebrow="Rewind" title="You had to be there." href="/events?tab=past" cta="Past nights" />
          </div>
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 md:px-8 [scrollbar-width:none]">
            {past.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.slug}`}
                className="group relative w-64 shrink-0 snap-start overflow-hidden rounded-card border border-line md:w-72"
              >
                <Poster src={event.posterUrl} alt={`${event.title} poster`} sizes="288px" className="transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/70 to-transparent p-4 pt-16">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">{formatEventDate(event.startsAt)}</p>
                  <p className="font-display text-xl font-bold">{event.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="relative overflow-hidden border-y border-line bg-surface">
        <Glow className="-right-24 -top-24 size-96" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-20 md:grid-cols-2 md:items-center md:px-8">
          <Reveal>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-brand">The philosophy</p>
            <h2 className="text-4xl font-extrabold leading-[0.95] md:text-6xl">
              Put the phone down.
              <br />
              <span className="text-brand">Ride the wave.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="space-y-6 text-lg text-muted">
            <p>
              Oflinewave throws nights for people who&apos;d rather feel it than film it. Big sound, good people, zero
              doom-scrolling.
            </p>
            <p>Show up. Plug in to the room. Leave with stories, not screenshots.</p>
            <Button asChild variant="outline">
              <Link href="/about">
                Meet the wave <ArrowRight />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28" aria-labelledby="ig-heading">
        <SectionHeading
          id="ig-heading"
          eyebrow="@oflinewave"
          title="Highlights from the floor."
          href={settings.instagramUrl ?? "https://instagram.com"}
          cta="Follow on Instagram"
          external
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[...past, ...upcoming].slice(0, 8).map((event, i) => (
            <a
              key={`${event.id}-${i}`}
              href={settings.instagramUrl ?? "https://instagram.com"}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden rounded-xl"
              aria-label={`${event.title} on Instagram`}
            >
              <Poster src={event.posterUrl} alt="" sizes="25vw" className="aspect-square transition duration-500 group-hover:scale-105" />
              <span className="absolute inset-0 bg-brand/0 transition group-hover:bg-brand/20" />
            </a>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden px-5 pb-24 md:px-8">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-brand/30 bg-gradient-to-br from-brand/20 via-surface to-surface p-8 text-center md:p-16">
          <WaveLine className="absolute inset-x-0 top-6 h-10 opacity-40" />
          <h2 className="relative text-4xl font-extrabold md:text-5xl">First to know. First on the floor.</h2>
          <p className="relative mx-auto mt-4 max-w-md text-muted">Drops go fast. Get early-bird links before anyone else.</p>
          <div className="relative mt-8 flex justify-center">
            <NewsletterForm />
          </div>
        </div>
      </section>
    </>
  );
}

function Hero({ featured }: { featured: Awaited<ReturnType<typeof getFeaturedEvent>> }) {
  if (!featured) {
    return (
      <section className="relative overflow-hidden px-5 pb-24 pt-20 text-center md:px-8">
        <Glow className="left-1/2 top-0 size-[32rem] -translate-x-1/2" />
        <h1 className="relative text-6xl font-extrabold leading-[0.9] md:text-8xl">
          Get offline.
          <br />
          <span className="text-brand text-glow">Get loud.</span>
        </h1>
        <p className="relative mx-auto mt-6 max-w-md text-lg text-muted">New nights dropping soon. Join the list and be first in.</p>
        <WaveLine className="mt-16 h-20" />
      </section>
    );
  }

  const price = fromPrice(featured);
  const soldOut = isSoldOut(featured);

  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-heading">
      <Glow className="-left-40 top-10 size-[36rem]" />
      <Glow className="-right-40 bottom-0 size-[28rem] opacity-60" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-10 md:grid-cols-[1.1fr_0.9fr] md:gap-16 md:px-8 md:pb-24 md:pt-16">
        <div className="order-2 md:order-1">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            <span className="size-1.5 rounded-full bg-brand animate-pulse-glow" /> Next up
          </p>
          <h1 id="hero-heading" className="text-[clamp(3.5rem,11vw,8.5rem)] font-extrabold leading-[0.85]">
            {featured.title}
          </h1>
          {featured.tagline && <p className="mt-5 max-w-lg text-lg text-muted md:text-xl">{featured.tagline}</p>}
          <dl className="mt-8 grid max-w-lg gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <CalendarDays className="size-5 text-brand" aria-hidden />
              <div>
                <dt className="sr-only">Date</dt>
                <dd className="font-semibold">
                  {formatEventDate(featured.startsAt)} · {formatEventTime(featured.startsAt)}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="size-5 text-brand" aria-hidden />
              <div>
                <dt className="sr-only">Venue</dt>
                <dd className="font-semibold">
                  {featured.venue.name}, {featured.venue.city}
                </dd>
              </div>
            </div>
          </dl>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="shadow-glow">
              <Link href={`/events/${featured.slug}#tickets`}>
                <Ticket /> {soldOut ? "Join the waitlist" : "Get tickets"}
              </Link>
            </Button>
            {price !== null && !soldOut && (
              <span className="text-sm text-muted">
                {price === 0 ? "Free RSVP" : <>From <span className="font-semibold text-white">{formatPrice(price)}</span></>}
              </span>
            )}
          </div>
        </div>
        <Link href={`/events/${featured.slug}`} className="order-1 block md:order-2" aria-label={`${featured.title} details`}>
          <div className="relative mx-auto max-w-md rotate-[-2deg] transition duration-500 hover:rotate-0 motion-safe:animate-[poster-in_0.8s_cubic-bezier(0.22,1,0.36,1)]">
              <div className="absolute -inset-4 rounded-[2rem] bg-brand/30 blur-3xl" aria-hidden />
              <Poster
                src={featured.posterUrl}
                alt={`${featured.title} poster`}
                priority
                sizes="(min-width: 768px) 40vw, 90vw"
                className="relative rounded-card border border-white/10 shadow-2xl"
              />
            </div>
        </Link>
      </div>
      <WaveLine className="h-16 md:h-24" />
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Ticket, title: "Pick your night", body: "Choose a tier, pay with card, transfer or USSD. Done in a minute." },
    { icon: QrCode, title: "Get your QR", body: "Tickets land in your inbox and in My Tickets. No app to download." },
    { icon: Smartphone, title: "Phone down", body: "One scan at the door, then the phone goes in your pocket. All night." },
  ];
  return (
    <section className="bg-white text-ink" aria-labelledby="how-heading">
      <WaveDivider fill="#0A0A0A" className="bg-white" />
      <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#C2410C]">How it works</p>
        <h2 id="how-heading" className="max-w-2xl text-4xl font-extrabold leading-[0.95] md:text-6xl">
          Three steps to the floor.
        </h2>
        <ol className="mt-14 grid gap-10 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title}>
              <Reveal delay={i * 0.08}>
                <div className="mb-5 flex items-center gap-4">
                  <span className="grid size-12 place-items-center rounded-full bg-ink text-brand">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-display text-5xl font-extrabold text-ink/10">0{i + 1}</span>
                </div>
                <h3 className="text-2xl font-bold">{step.title}</h3>
                <p className="mt-2 text-ink/70">{step.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
      <WaveDivider fill="#0A0A0A" flip className="bg-white" />
    </section>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  href,
  cta,
  external,
}: {
  id: string;
  eyebrow: string;
  title: string;
  href: string;
  cta: string;
  external?: boolean;
}) {
  const linkClass = "group inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-brand";
  return (
    <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-brand">{eyebrow}</p>
        <h2 id={id} className="max-w-xl text-4xl font-extrabold leading-[0.95] md:text-5xl">
          {title}
        </h2>
      </div>
      {external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {cta} <ArrowRight className="size-4 transition group-hover:translate-x-1" />
        </a>
      ) : (
        <Link href={href} className={linkClass}>
          {cta} <ArrowRight className="size-4 transition group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
