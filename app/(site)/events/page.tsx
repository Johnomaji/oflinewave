import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EventCard } from "@/components/site/event-card";
import { CATEGORY_LABELS, getCities, searchEvents, type EventFilters } from "@/lib/data/events";
import type { EventCategory } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Events",
  description: "Upcoming Oflinewave parties, concerts, brunches and pop-ups in Lagos.",
};

type SearchParams = Record<string, string | string[] | undefined>;

const PRICE_OPTIONS = [
  { value: "", label: "Any price" },
  { value: "free", label: "Free" },
  { value: "under10k", label: "Under ₦10k" },
  { value: "10k-30k", label: "₦10k – ₦30k" },
  { value: "over30k", label: "₦30k+" },
];

const WHEN_OPTIONS = [
  { value: "", label: "Any date" },
  { value: "tonight", label: "Tonight" },
  { value: "weekend", label: "This weekend" },
  { value: "week", label: "Next 7 days" },
  { value: "month", label: "Next 30 days" },
];

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

function parseFilters(sp: SearchParams): EventFilters {
  const category = one(sp.category);
  const price = one(sp.price);
  const when = one(sp.when);
  return {
    tab: one(sp.tab) === "past" ? "past" : "upcoming",
    q: one(sp.q)?.slice(0, 80),
    city: one(sp.city)?.slice(0, 60),
    category: category && category in CATEGORY_LABELS ? (category as EventCategory) : undefined,
    price: PRICE_OPTIONS.some((o) => o.value && o.value === price) ? (price as EventFilters["price"]) : undefined,
    when: WHEN_OPTIONS.some((o) => o.value && o.value === when) ? (when as EventFilters["when"]) : undefined,
  };
}

export default function EventsPage({ searchParams }: PageProps<"/events">) {
  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-brand">Events</p>
      <h1 className="text-5xl font-extrabold leading-[0.9] md:text-7xl">Find your night.</h1>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseFilters(await searchParams);
  const [events, cities] = await Promise.all([searchEvents(filters), getCities()]);
  const past = filters.tab === "past";

  return (
    <>
      <nav aria-label="Event tabs" className="mt-10 flex gap-2">
        {(["upcoming", "past"] as const).map((tab) => (
          <Link
            key={tab}
            href={tab === "past" ? "/events?tab=past" : "/events"}
            aria-current={filters.tab === tab ? "page" : undefined}
            className={cn(
              "rounded-full border px-5 py-2 text-sm font-semibold capitalize transition",
              filters.tab === tab ? "border-brand bg-brand text-ink" : "border-line text-muted hover:text-white",
            )}
          >
            {tab}
          </Link>
        ))}
      </nav>

      {!past && (
        <nav aria-label="Quick filters" className="mt-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {([
            { label: "Tonight", params: { when: "tonight" } },
            { label: "This weekend", params: { when: "weekend" } },
            { label: "Free", params: { price: "free" } },
            ...Object.entries(CATEGORY_LABELS)
              .filter(([key]) => key !== "OTHER")
              .map(([key, label]) => ({ label, params: { category: key } })),
          ] as { label: string; params: Record<string, string> }[]).map((chip) => {
            const active = Object.entries(chip.params).every(([k, v]) => (filters as Record<string, unknown>)[k] === v);
            const href = active ? "/events" : `/events?${new URLSearchParams(chip.params)}`;
            return (
              <Link
                key={chip.label}
                href={href}
                aria-pressed={active}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-sm transition",
                  active ? "border-brand bg-brand/15 text-brand" : "border-line text-muted hover:border-white/40 hover:text-white",
                )}
              >
                {chip.label}
              </Link>
            );
          })}
        </nav>
      )}

      <form method="get" action="/events" className="mt-6 grid gap-3 rounded-card border border-line bg-surface p-4 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]" role="search">
        {past && <input type="hidden" name="tab" value="past" />}
        <div className="relative">
          <label htmlFor="q" className="sr-only">
            Search events
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input id="q" name="q" defaultValue={filters.q} placeholder="Search events, artists, venues" className="pl-11" />
        </div>
        <FilterSelect name="category" label="Category" value={filters.category} options={[{ value: "", label: "All types" }, ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))]} />
        <FilterSelect name="city" label="Location" value={filters.city} options={[{ value: "", label: "All cities" }, ...cities.map((c) => ({ value: c, label: c }))]} />
        {!past && <FilterSelect name="when" label="Date" value={filters.when} options={WHEN_OPTIONS} />}
        {!past && <FilterSelect name="price" label="Price" value={filters.price} options={PRICE_OPTIONS} />}
        <Button type="submit" className="h-12">
          Filter
        </Button>
      </form>

      <p className="mt-8 text-sm text-muted" role="status">
        {events.length} {events.length === 1 ? "event" : "events"}
      </p>

      {events.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line p-12 text-center">
          <p className="font-display text-2xl font-bold">Nothing here. Yet.</p>
          <p className="mt-2 text-muted">Try a different filter, or join the list and hear about the next drop first.</p>
          <Button asChild variant="outline" className="mt-6">
            <Link href={past ? "/events?tab=past" : "/events"}>Clear filters</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event, i) => (
            <EventCard key={event.id} event={event} past={past} priority={i < 3} />
          ))}
        </div>
      )}
    </>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="sr-only">
        {label}
      </label>
      <Select id={`f-${name}`} name={name} defaultValue={value ?? ""}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="aspect-4/6 animate-pulse rounded-card bg-surface" />
      ))}
    </div>
  );
}
