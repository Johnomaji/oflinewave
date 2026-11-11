import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ContentPage } from "@/components/site/content-page";

export const metadata: Metadata = {
  title: "About",
  description: "Oflinewave is a touring entertainment brand creating large-scale party experiences across cities.",
};

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow="About"
      title={
        <>
          The party
          <br />
          <span className="text-brand">that travels.</span>
        </>
      }
      intro="Oflinewave is a touring entertainment brand creating large-scale party experiences through music, live performances, DJs and culture-driven social moments."
      media={
        <div className="relative aspect-[4/5] overflow-hidden rounded-card border border-white/10 sm:aspect-[16/10]">
          <Image
            src="/photos/floor-2.jpg"
            alt="Guest at an Oflinewave night wearing the official pass"
            fill
            priority
            sizes="(min-width: 768px) 48rem, 100vw"
            className="object-cover object-[50%_22%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" aria-hidden />
        </div>
      }
    >
      <h2>Our vision</h2>
      <p>
        To build a recognisable entertainment brand that travels across cities, creating memorable experiences while
        establishing sustainable commercial opportunities.
      </p>
      <div className="pt-6">
        <Button asChild size="lg">
          <Link href="/events">See upcoming events</Link>
        </Button>
      </div>
    </ContentPage>
  );
}
