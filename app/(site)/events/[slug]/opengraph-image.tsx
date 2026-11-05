import { ImageResponse } from "next/og";
import { dateParts, formatEventTime } from "@/lib/dates";
import { getEventBySlug } from "@/lib/data/events";
import { OgWave, Wordmark, imageSrc, logoSrc } from "@/lib/og";
import { tokens } from "@/lib/tokens";

export const alt = "Oflinewave event";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const c = tokens.colors;

/** Branded share card: poster on the left, date + title + venue on the right. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [event, logo] = await Promise.all([getEventBySlug(slug), logoSrc()]);

  if (!event) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: c.black }}>
          <Wordmark src={logo} height={160} />
        </div>
      ),
      size,
    );
  }

  const poster = await imageSrc(event.posterUrl);
  const { day, month } = dateParts(event.startsAt);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: c.black, color: c.white, position: "relative", padding: 48, gap: 48 }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- satori */}
        <img src={poster} width={428} height={534} style={{ borderRadius: 24, objectFit: "cover", boxShadow: `0 20px 80px ${c.orange}66` }} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", paddingBottom: 40 }}>
          <Wordmark src={logo} height={64} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, color: c.orange }}>
              <span style={{ fontSize: 96, fontWeight: 800, lineHeight: 1 }}>{day}</span>
              <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: 4 }}>{month}</span>
              <span style={{ fontSize: 28, color: c.muted, marginLeft: 8 }}>{formatEventTime(event.startsAt)}</span>
            </div>
            <div style={{ fontSize: event.title.length > 22 ? 64 : 84, fontWeight: 800, lineHeight: 0.95, letterSpacing: -3, marginTop: 16 }}>{event.title}</div>
            <div style={{ fontSize: 30, color: c.muted, marginTop: 20 }}>
              {`${event.venue.name}, ${event.venue.city}`}
            </div>
          </div>
          <div style={{ display: "flex", alignSelf: "flex-start", background: c.orange, color: c.black, fontSize: 28, fontWeight: 800, padding: "14px 32px", borderRadius: 999 }}>
            Get tickets
          </div>
        </div>
        <OgWave />
      </div>
    ),
    size,
  );
}
