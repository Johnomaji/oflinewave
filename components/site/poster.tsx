import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Event poster. SVGs skip the optimizer (they're already vector).
 * `waves` lays the brand treatment (orange wash + wavy lines) over photo and
 * JPG posters, so uploaded artwork still looks like an Oflinewave card. The
 * built-in SVG posters already carry it.
 */
export function Poster({
  src,
  alt,
  priority,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  waves = false,
  className,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  waves?: boolean;
  className?: string;
}) {
  const vector = src.endsWith(".svg");
  return (
    <div className={cn("relative aspect-4/5 overflow-hidden bg-surface", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={vector}
        // Upper-middle crop keeps faces in frame when a tall photo fills a 4:5 card.
        className="object-cover object-[50%_30%]"
      />
      {waves && !vector && <PosterWaves />}
    </div>
  );
}

function PosterWaves() {
  const lines = [0, 1, 2, 3, 4, 5];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-br from-brand/25 via-transparent to-transparent mix-blend-soft-light" />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#7A1E05]/70 via-brand/15 to-transparent" />
      <svg viewBox="0 0 800 200" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-1/4 w-full">
        {lines.map((i) => {
          const y = 40 + i * 24;
          const a = 10 + i * 6;
          return (
            <path
              key={i}
              d={`M -50 ${y} C 150 ${y - a}, 250 ${y + a}, 400 ${y} S 650 ${y - a}, 850 ${y}`}
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity={0.12 + i * 0.06}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  );
}
