import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ContentPage } from "@/components/site/content-page";

export const metadata: Metadata = {
  title: "About",
  description: "Oflinewave throws parties for people who'd rather feel it than film it.",
};

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow="About"
      title={
        <>
          Phones down.
          <br />
          <span className="text-brand">Volume up.</span>
        </>
      }
      intro="Oflinewave is a Lagos crew that throws nights for people who'd rather feel it than film it."
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
      <p>We started with one rule: the phone stays in your pocket. What happened next surprised us. People talked. People danced like nobody was watching, because nobody was.</p>
      <h2>What we do</h2>
      <ul>
        <li>Warehouse parties that run till sunrise.</li>
        <li>Day parties and brunches that turn into dance-offs.</li>
        <li>Live shows with no screens between you and the stage.</li>
        <li>Pop-ups in places you didn&apos;t know existed.</li>
      </ul>
      <h2>The deal</h2>
      <p>Show up. Plug in to the room. Meet someone new. Leave with stories, not screenshots.</p>
      <p>We&apos;ll handle the sound, the lights and the vibe. You handle being there.</p>
      <div className="pt-6">
        <Button asChild size="lg">
          <Link href="/events">Find your night</Link>
        </Button>
      </div>
    </ContentPage>
  );
}
