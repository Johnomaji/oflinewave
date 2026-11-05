import Image from "next/image";
import { cn } from "@/lib/utils";

/** Event poster. SVGs skip the optimizer (they're already vector). */
export function Poster({
  src,
  alt,
  priority,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  className,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-4/5 overflow-hidden bg-surface", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={src.endsWith(".svg")}
        className="object-cover"
      />
    </div>
  );
}
