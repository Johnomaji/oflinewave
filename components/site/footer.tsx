import Link from "next/link";
import { Logo } from "./logo";
import { NewsletterForm } from "./newsletter-form";
import { WaveLine } from "./wave";

const LINKS = [
  {
    title: "Go out",
    items: [
      { href: "/events", label: "Upcoming events" },
      { href: "/events?tab=past", label: "Past nights" },
      { href: "/tickets", label: "My tickets" },
    ],
  },
  {
    title: "Oflinewave",
    items: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "The fine print",
    items: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/refunds", label: "Refund policy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative mt-auto border-t border-line pt-16">
      <WaveLine className="absolute inset-x-0 -top-6 h-12 opacity-60" />
      <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-10 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
        <div className="space-y-5">
          <Logo className="h-12" />
          <p className="max-w-xs text-sm text-muted">Get offline. Get loud. First dibs on drops, straight to your inbox.</p>
          <NewsletterForm />
        </div>
        {LINKS.map((group) => (
          <div key={group.title}>
            <h2 className="mb-4 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-muted">{group.title}</h2>
            <ul className="space-y-3">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-white/80 transition-colors hover:text-brand">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-muted md:flex-row md:justify-between md:px-8">
          <p>© Oflinewave, Lagos. Real nights, real people.</p>
          <p>Phones down. Volume up.</p>
        </div>
      </div>
    </footer>
  );
}
