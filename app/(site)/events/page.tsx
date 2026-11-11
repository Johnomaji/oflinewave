import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EventCard } from "@/components/site/event-card";
import { searchEvents, type EventFilters } from "@/lib/data/events";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Events",
  description: "Upcoming Oflinewave parties, concerts, brunches and pop-ups in Lagos.",
};

type SearchParams = Record<string, string | string[] | undefined>;

const WHEN_OPTIONS = {
  upcoming: [
    { value: "", label: "Any date" },
    { value: "tonight", label: "Tonight" },
    { value: "weekend", label: "This weekend" },
    { value: "week", label: "Next 7 days" },
    { value: "month", label: "Next 30 days" },
  ],
  past: [
    { value: "", label: "Any date" },
    { value: "week", label: "Last 7 days" },
    { value: "month", label: "Last 30 days" },
    { value: "year", label: "Last 12 months" },
  ],
};

const SORT_OPTIONS = [
  { value: "", label: "Sort by date" },
  { value: "name", label: "Sort by name (A–Z)" },
];

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

function parseFilters(sp: SearchParams): EventFilters {
  const tab = one(sp.tab) === "past" ? "past" : "upcoming";
  const when = one(sp.when);
  return {
    tab,
    q: one(sp.q)?.slice(0, 80),
    when: WHEN_OPTIONS[tab].some((o) => o.value && o.value === when) ? (when as EventFilters["when"]) : undefined,
    sort: one(sp.sort) === "name" ? "name" : "date",
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
  const events = await searchEvents(filters);
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

      <form method="get" action="/events" className="mt-6 grid gap-3 rounded-card border border-line bg-surface p-4 md:grid-cols-[2fr_1fr_1fr_auto]" role="search">
        {past && <input type="hidden" name="tab" value="past" />}
        <div className="relative">
          <label htmlFor="q" className="sr-only">
            Search events
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input id="q" name="q" defaultValue={filters.q} placeholder="Search events, artists, venues" className="pl-11" />
        </div>
        <FilterSelect name="when" label="Date" value={filters.when} options={WHEN_OPTIONS[filters.tab]} />
        <FilterSelect name="sort" label="Sort" value={filters.sort === "name" ? "name" : ""} options={SORT_OPTIONS} />
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
