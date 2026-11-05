"use client";

import { BarChart3, CalendarRange, ScanLine, Settings, Tag, Receipt, ExternalLink, QrCode } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: BarChart3, exact: true },
  { href: "/admin/events", label: "Events", icon: CalendarRange },
  { href: "/admin/orders", label: "Orders", icon: Receipt },
  { href: "/admin/promos", label: "Promo codes", icon: Tag },
  { href: "/admin/checkin", label: "Check-in", icon: ScanLine },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

/** Pathname is request data; the fallback renders the same links without highlighting. */
export function AdminNav() {
  return (
    <Suspense fallback={<NavLinks pathname="" />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-4 md:pb-6">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active ? "bg-brand text-ink" : "text-muted hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </Link>
        );
      })}
      <div className="hidden md:my-4 md:block md:border-t md:border-line" />
      <Link href="/scan" className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:text-white">
        <QrCode className="size-4" aria-hidden /> Door scanner
      </Link>
      <Link href="/" className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:text-white">
        <ExternalLink className="size-4" aria-hidden /> View site
      </Link>
    </nav>
  );
}
