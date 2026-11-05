"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function MobileMenu({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        className="grid size-10 place-items-center rounded-full border border-line"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="fixed inset-x-0 top-16 z-50 flex h-[calc(100dvh-4rem)] flex-col gap-1 bg-ink px-5 pt-6"
          onKeyDown={(e) => e.key === "Escape" && close()}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className="border-b border-line py-4 font-display text-3xl font-bold"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/events"
            onClick={close}
            className="mt-8 rounded-full bg-brand py-4 text-center text-lg font-semibold text-ink"
          >
            Get tickets
          </Link>
        </nav>
      )}
    </div>
  );
}
