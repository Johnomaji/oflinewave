import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Glow, WaveLine } from "@/components/site/wave";

export default function NotFound() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 text-center">
      <Glow className="left-1/2 top-1/3 size-96 -translate-x-1/2" />
      <div className="relative">
        <p className="font-display text-8xl font-extrabold text-brand text-glow">404</p>
        <h1 className="mt-4 text-4xl font-extrabold">Lost the signal.</h1>
        <p className="mt-3 text-muted">This page left the party. The good stuff is this way.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild>
            <Link href="/events">See events</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Home</Link>
          </Button>
        </div>
        <WaveLine className="mt-12 h-10" />
      </div>
    </main>
  );
}
