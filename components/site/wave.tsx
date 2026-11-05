import { cn } from "@/lib/utils";

/**
 * The Oflinewave motif. A long, repeating curve that drifts sideways.
 * Drift is CSS-only and switches off under prefers-reduced-motion.
 */
export function WaveLine({ className, animate = true }: { className?: string; animate?: boolean }) {
  const path = "M0 60 C 150 10, 250 110, 400 60 S 650 10, 800 60 S 1050 110, 1200 60 S 1450 10, 1600 60";
  return (
    <div className={cn("pointer-events-none overflow-hidden", className)} aria-hidden>
      <svg viewBox="0 0 1600 120" preserveAspectRatio="none" className={cn("h-full w-[200%]", animate && "animate-wave")}>
        <defs>
          <linearGradient id="wave-stroke" x1="0" x2="1">
            <stop offset="0" stopColor="#FF5A1F" stopOpacity="0" />
            <stop offset="0.3" stopColor="#FF5A1F" />
            <stop offset="0.7" stopColor="#FF7A45" />
            <stop offset="1" stopColor="#FF5A1F" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="url(#wave-stroke)" strokeWidth="3" />
        <path d={path} fill="none" stroke="#FF5A1F" strokeOpacity="0.25" strokeWidth="12" style={{ filter: "blur(8px)" }} />
      </svg>
    </div>
  );
}

/** Section divider: a filled wave that blends one background into the next. */
export function WaveDivider({ className, flip = false, fill = "#FFFFFF" }: { className?: string; flip?: boolean; fill?: string }) {
  return (
    <div className={cn("pointer-events-none -mb-px leading-none", flip && "rotate-180", className)} aria-hidden>
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="block h-12 w-full md:h-20">
        <path d="M0 40 C 240 0, 480 80, 720 40 S 1200 0, 1440 40 V 80 H 0 Z" fill={fill} />
      </svg>
    </div>
  );
}

/** Orange glow blob for hero backgrounds. */
export function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full bg-brand/30 blur-[120px] animate-pulse-glow",
        className,
      )}
    />
  );
}
