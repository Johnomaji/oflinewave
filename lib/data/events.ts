import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { tonightRange, weekendRange } from "@/lib/dates";
import type { EventCategory, Prisma } from "@/lib/generated/prisma/client";

/**
 * Cached reads for public pages. Admin mutations call revalidateTag/updateTag
 * with EVENTS_TAG / eventTag(slug), so edits show up without a redeploy.
 * Live ticket availability is NOT cached here; see getAvailability().
 */
export const EVENTS_TAG = "events";
export const eventTag = (slug: string) => `event:${slug}`;

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  tagline: true,
  category: true,
  startsAt: true,
  endsAt: true,
  posterUrl: true,
  featured: true,
  venue: { select: { name: true, city: true } },
  tiers: {
    where: { visibility: "PUBLIC" },
    select: { price: true, quantity: true, sold: true },
  },
} satisfies Prisma.EventSelect;

export type EventCard = Prisma.EventGetPayload<{ select: typeof cardSelect }>;

function upcomingWhere(now: Date): Prisma.EventWhereInput {
  return {
    status: "PUBLISHED",
    listed: true,
    OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }],
  };
}

function pastWhere(now: Date): Prisma.EventWhereInput {
  return {
    status: { in: ["PUBLISHED", "ARCHIVED"] },
    listed: true,
    OR: [{ endsAt: { lt: now } }, { endsAt: null, startsAt: { lt: now } }],
  };
}

export async function getUpcomingEvents(limit = 12): Promise<EventCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(EVENTS_TAG);
  return db.event.findMany({
    where: upcomingWhere(new Date()),
    orderBy: { startsAt: "asc" },
    take: limit,
    select: cardSelect,
  });
}

export async function getPastEvents(limit = 8): Promise<EventCard[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(EVENTS_TAG);
  return db.event.findMany({
    where: pastWhere(new Date()),
    orderBy: { startsAt: "desc" },
    take: limit,
    select: cardSelect,
  });
}

export async function getFeaturedEvent(): Promise<EventCard | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(EVENTS_TAG);
  return db.event.findFirst({
    where: upcomingWhere(new Date()),
    orderBy: [{ featured: "desc" }, { startsAt: "asc" }],
    select: cardSelect,
  });
}

export type EventFilters = {
  q?: string;
  /** "week", "month" and "year" look forward on the upcoming tab and back on the past tab. */
  when?: "tonight" | "weekend" | "week" | "month" | "year";
  sort?: "date" | "name";
  tab: "upcoming" | "past";
};

const WHEN_DAYS = { week: 7, month: 31, year: 365 };

export async function searchEvents(filters: EventFilters): Promise<EventCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(EVENTS_TAG);

  const now = new Date();
  const and: Prisma.EventWhereInput[] = [filters.tab === "past" ? pastWhere(now) : upcomingWhere(now)];

  if (filters.q) {
    and.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { tagline: { contains: filters.q, mode: "insensitive" } },
        { lineup: { has: filters.q } },
        { venue: { name: { contains: filters.q, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.when === "tonight" || filters.when === "weekend") {
    const [from, to] = filters.when === "tonight" ? tonightRange(now) : weekendRange(now);
    // Anything running during the window, including events that started earlier.
    and.push({ startsAt: { lt: to }, OR: [{ endsAt: { gte: from } }, { endsAt: null, startsAt: { gte: from } }] });
  } else if (filters.when) {
    const span = WHEN_DAYS[filters.when] * 86_400_000;
    and.push(
      filters.tab === "past"
        ? { startsAt: { gte: new Date(now.getTime() - span) } }
        : { startsAt: { lte: new Date(now.getTime() + span) } },
    );
  }

  return db.event.findMany({
    where: { AND: and },
    orderBy: filters.sort === "name" ? { title: "asc" } : { startsAt: filters.tab === "past" ? "desc" : "asc" },
    take: 48,
    select: cardSelect,
  });
}

/** "More like this": upcoming events, same category first, then anything soon. */
export async function getRelatedEvents(eventId: string, category: EventCategory, limit = 3): Promise<EventCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(EVENTS_TAG);
  const base = { ...upcomingWhere(new Date()), id: { not: eventId } };
  const same = await db.event.findMany({ where: { ...base, category }, orderBy: { startsAt: "asc" }, take: limit, select: cardSelect });
  if (same.length >= limit) return same;
  const others = await db.event.findMany({
    where: { ...base, id: { notIn: [eventId, ...same.map((e) => e.id)] } },
    orderBy: { startsAt: "asc" },
    take: limit - same.length,
    select: cardSelect,
  });
  return [...same, ...others];
}

/** Public event page payload. Hidden (code-only) tiers are never included; member-only tiers are, marked by visibility. */
export async function getEventBySlug(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(EVENTS_TAG, eventTag(slug));
  return db.event.findFirst({
    where: { slug, status: { in: ["PUBLISHED", "ARCHIVED"] } },
    include: {
      venue: true,
      media: { orderBy: { sortOrder: "asc" } },
      tiers: {
        where: { visibility: { in: ["PUBLIC", "MEMBERS"] } },
        orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
        select: {
          id: true,
          visibility: true,
          name: true,
          description: true,
          price: true,
          minPerOrder: true,
          maxPerOrder: true,
          admits: true,
          salesStart: true,
          salesEnd: true,
        },
      },
      addOns: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, description: true, price: true, maxPerOrder: true },
      },
    },
  });
}

export type PublicEvent = NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>;

export async function getSitemapEvents() {
  "use cache";
  cacheLife("hours");
  cacheTag(EVENTS_TAG);
  return db.event.findMany({
    where: { status: { in: ["PUBLISHED", "ARCHIVED"] }, listed: true },
    select: { slug: true, updatedAt: true },
  });
}

/** Lowest public price, for "From ₦X" labels. */
export function fromPrice(event: Pick<EventCard, "tiers">) {
  if (event.tiers.length === 0) return null;
  return Math.min(...event.tiers.map((t) => t.price));
}

export function isSoldOut(event: Pick<EventCard, "tiers">) {
  return event.tiers.length > 0 && event.tiers.every((t) => t.sold >= t.quantity);
}

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  PARTY: "Party",
  CONCERT: "Concert",
  BRUNCH: "Brunch",
  POP_UP: "Pop-up",
  DAY_PARTY: "Day party",
  OTHER: "Other",
};
