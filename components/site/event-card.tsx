import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { dateParts, formatEventTime } from "@/lib/dates";
import { CATEGORY_LABELS, fromPrice, isSoldOut, type EventCard as EventCardData } from "@/lib/data/events";
import { formatPrice } from "@/lib/money";
import { Poster } from "./poster";

export function EventCard({ event, past = false, priority }: { event: EventCardData; past?: boolean; priority?: boolean }) {
  const { day, month } = dateParts(event.startsAt);
  const price = fromPrice(event);
  const soldOut = isSoldOut(event);
  const left = event.tiers.reduce((sum, t) => sum + Math.max(t.quantity - t.sold, 0), 0);
  const total = event.tiers.reduce((sum, t) => sum + t.quantity, 0);
  const sellingFast = !soldOut && total > 0 && left / total < 0.25;

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group block overflow-hidden rounded-card border border-line bg-surface transition duration-300 hover:-translate-y-1 hover:border-brand/50 hover:shadow-glow focus-visible:shadow-glow"
    >
      <div className="relative">
        <Poster
          src={event.posterUrl}
          alt={`${event.title} poster`}
          priority={priority}
          waves
          className="transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3 flex flex-col items-center rounded-xl bg-ink/85 px-3 py-2 text-center backdrop-blur">
          <span className="font-display text-xl font-extrabold leading-none">{day}</span>
          <span className="mt-0.5 text-[10px] font-semibold tracking-[0.2em] text-brand">{month}</span>
        </div>
        <div className="absolute right-3 top-3 flex gap-2">
          {!past && soldOut && <Badge variant="neutral">Sold out</Badge>}
          {!past && sellingFast && <Badge variant="brand">Selling fast</Badge>}
        </div>
      </div>
      <div className="space-y-2 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {CATEGORY_LABELS[event.category]} · {event.venue.name}
        </p>
        <h3 className="text-2xl font-bold leading-tight group-hover:text-brand">{event.title}</h3>
        <div className="flex items-center justify-between pt-1 text-sm">
          <span className="text-muted">{past ? event.venue.city : `${formatEventTime(event.startsAt)} · ${event.venue.city}`}</span>
          {!past && price !== null && (
            <span className="font-semibold text-brand">{price === 0 ? "Free RSVP" : `From ${formatPrice(price)}`}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
