"use client";

import { useEffect } from "react";

/** Fires one funnel beacon per mount. Skips bots and Do-Not-Track browsers. */
export function TrackView({ type, eventId }: { type: "event_view" | "checkout_view"; eventId: string }) {
  useEffect(() => {
    if (navigator.doNotTrack === "1" || /bot|crawl|spider/i.test(navigator.userAgent)) return;
    const referrer = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : undefined;
    const body = JSON.stringify({ type, eventId, referrer });
    if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  }, [type, eventId]);
  return null;
}
