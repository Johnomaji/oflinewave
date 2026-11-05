import type { Metadata } from "next";
import { WaveLine } from "@/components/site/wave";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

/** Served by the service worker when a page isn't cached and there's no signal. */
export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        {/* Plain <img>: the service worker precaches this file, the image optimiser URL it can't. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="Oflinewave" width={163} height={48} className="mx-auto h-12 w-auto" />
        <h1 className="mt-8 text-5xl font-extrabold leading-[0.9]">
          You&apos;re offline.
          <br />
          <span className="text-brand">Ironic, right?</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xs text-muted">
          Tickets you&apos;ve opened before still work. Open them from My tickets, or reconnect for everything else.
        </p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full navigation so the service worker can serve the cached page */}
        <a href="/tickets" className="mt-8 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-ink">
          My tickets
        </a>
        <WaveLine className="mt-12 h-10" />
      </div>
    </main>
  );
}
