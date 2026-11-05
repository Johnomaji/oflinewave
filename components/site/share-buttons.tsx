"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useState } from "react";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const text = `${title} · Oflinewave`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch {
        // dismissed: fall through to copy
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const chip = "inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium transition hover:border-white/40";
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={share} className={chip}>
        {copied ? <Check className="size-4 text-success" /> : <Share2 className="size-4" />}
        {copied ? "Link copied" : "Share"}
      </button>
      <a className={chip} href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer">
        WhatsApp
      </a>
      <a className={chip} href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
        X
      </a>
      <button
        type="button"
        className={chip}
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        aria-label="Copy link"
      >
        <Link2 className="size-4" />
      </button>
    </div>
  );
}
