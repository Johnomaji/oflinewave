import { getEventBySlug } from "@/lib/data/events";
import { toIcs } from "@/lib/calendar";
import { appUrl } from "@/lib/utils";

export async function GET(_req: Request, ctx: RouteContext<"/events/[slug]/calendar">) {
  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event) return new Response("Not found", { status: 404 });

  const ics = toIcs({
    uid: event.id,
    title: event.title,
    description: event.tagline ?? event.title,
    location: `${event.venue.name}, ${event.venue.address}`,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    url: appUrl(`/events/${event.slug}`),
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
    },
  });
}
