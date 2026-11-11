import type { ReactNode } from "react";
import { WaveLine } from "./wave";

/** Shared shell for about/legal pages: big headline, readable column. */
export function ContentPage({
  eyebrow,
  title,
  intro,
  updated,
  media,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: string;
  updated?: string;
  /** Optional image shown under the intro. */
  media?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-12 md:py-20">
      {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-brand">{eyebrow}</p>}
      <h1 className="text-5xl font-extrabold leading-[0.9] md:text-7xl">{title}</h1>
      {intro && <p className="mt-6 text-xl text-muted">{intro}</p>}
      {updated && <p className="mt-4 text-sm text-muted">Last updated {updated}</p>}
      {media && <div className="mt-10">{media}</div>}
      <WaveLine className="my-10 h-8" animate={false} />
      <div className="space-y-6 text-lg leading-relaxed text-white/85 [&_li_a]:text-brand [&_li_a:hover]:underline [&_p_a]:text-brand [&_p_a:hover]:underline [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:font-extrabold [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </article>
  );
}
