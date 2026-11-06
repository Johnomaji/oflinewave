import Link from "next/link";
import { Suspense } from "react";
import { canScan, getCurrentUser, isAdmin, type CurrentUser } from "@/lib/dal";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";

export const NAV = [
  { href: "/events", label: "Events" },
  { href: "/events?tab=past", label: "Past nights" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

const MOBILE_NAV = [...NAV, { href: "/tickets", label: "My tickets" }];

/** Staff entry points, so admins and door staff never have to type a URL. */
function staffLinks(user: CurrentUser | null) {
  const links: { href: string; label: string }[] = [];
  if (isAdmin(user)) links.push({ href: "/admin", label: "Admin" });
  if (canScan(user)) links.push({ href: "/scan", label: "Door scanner" });
  return links;
}

async function AccountLinks() {
  const user = await getCurrentUser();
  return (
    <>
      {staffLinks(user).map((item) => (
        <Link key={item.href} href={item.href} className="text-sm text-muted transition-colors hover:text-white">
          {item.label}
        </Link>
      ))}
      <Link href="/tickets" className="text-sm text-muted transition-colors hover:text-white">
        {user ? "My tickets" : "Find my tickets"}
      </Link>
    </>
  );
}

async function AccountMobileMenu() {
  const user = await getCurrentUser();
  return <MobileMenu items={[...MOBILE_NAV, ...staffLinks(user)]} />;
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 md:px-8">
        <Logo priority />
        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-muted transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 md:flex">
          <Suspense
            fallback={
              <Link href="/tickets" className="text-sm text-muted hover:text-white">
                Find my tickets
              </Link>
            }
          >
            <AccountLinks />
          </Suspense>
          <Link
            href="/events"
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-ink transition hover:bg-brand-hover hover:shadow-glow-sm"
          >
            Get tickets
          </Link>
        </div>
        <Suspense fallback={<MobileMenu items={MOBILE_NAV} />}>
          <AccountMobileMenu />
        </Suspense>
      </div>
    </header>
  );
}
