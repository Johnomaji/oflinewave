import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmailSignIn } from "@/components/site/email-sign-in";
import { SignOutButton } from "@/components/site/sign-out-button";
import { WaveClubCard } from "@/components/site/wave-club-card";
import { Poster } from "@/components/site/poster";
import { formatDateTime } from "@/lib/dates";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

type OrderRow = Prisma.OrderGetPayload<{
  include: { event: { include: { venue: true } }; tickets: { select: { status: true; transferredAt: true } } };
}>;

export const metadata: Metadata = { title: "My tickets", robots: { index: false } };

export default function TicketsPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:py-16">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-brand">My tickets</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-surface" />}>
        <TicketsContent />
      </Suspense>
    </div>
  );
}

async function TicketsContent() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <h1 className="text-5xl font-extrabold leading-[0.9]">Find your tickets.</h1>
          <p className="mt-4 text-muted">
            Bought as a guest? No stress. Enter the email you used at checkout and we&apos;ll send a one-tap link to all your tickets.
          </p>
        </div>
        <div className="rounded-card border border-line bg-surface p-6">
          <EmailSignIn next="/tickets" cta="Email me my tickets" />
        </div>
      </div>
    );
  }

  const orders = await db.order.findMany({
    where: {
      status: { in: ["PAID", "REFUNDED"] },
      OR: [{ buyerEmail: user.email }, { userId: user.id }],
    },
    include: {
      event: { include: { venue: true } },
      tickets: { select: { status: true, transferredAt: true } },
    },
    orderBy: { event: { startsAt: "asc" } },
  });
  // Tickets someone else bought and passed to this user.
  const received = await db.ticket.findMany({
    where: {
      holderEmail: user.email,
      transferredAt: { not: null },
      status: { in: ["VALID", "CHECKED_IN"] },
      order: { status: "PAID", buyerEmail: { not: user.email } },
    },
    include: { event: { include: { venue: true } }, tier: { select: { name: true } } },
    orderBy: { event: { startsAt: "asc" } },
  });

  const now = new Date();
  const upcoming = orders.filter((o) => (o.event.endsAt ?? o.event.startsAt) >= now);
  const past = orders.filter((o) => (o.event.endsAt ?? o.event.startsAt) < now).reverse();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-5xl font-extrabold leading-[0.9]">Your nights.</h1>
        <SignOutButton email={user.email} />
      </div>

      <Suspense fallback={null}>
        <WaveClubCard email={user.email} />
      </Suspense>

      {received.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-muted">Passed to you</h2>
          <ul className="space-y-3">
            {received.map((t) => (
              <li key={t.id}>
                <Link href={`/tickets/${t.id}`} className="flex items-center gap-4 rounded-card border border-line bg-surface p-3 transition hover:border-brand/50">
                  <Poster src={t.event.posterUrl} alt="" sizes="80px" className="w-16 shrink-0 rounded-lg md:w-20" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-bold">{t.event.title}</p>
                    <p className="text-sm text-muted">
                      {formatDateTime(t.event.startsAt)} · {t.tier.name}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {orders.length === 0 && received.length === 0 ? (
        <div className="mt-10 rounded-card border border-dashed border-line p-12 text-center">
          <Ticket className="mx-auto size-10 text-brand" />
          <p className="mt-4 font-display text-2xl font-bold">No tickets yet.</p>
          <p className="mt-2 text-muted">Your next night is one tap away.</p>
          <Button asChild className="mt-6">
            <Link href="/events">Browse events</Link>
          </Button>
        </div>
      ) : (
        <>
          <OrderList title="Coming up" orders={upcoming} />
          <OrderList title="Been there" orders={past} muted />
        </>
      )}
    </>
  );
}

function OrderList({
  title,
  orders,
  muted,
}: {
  title: string;
  orders: OrderRow[];
  muted?: boolean;
}) {
  if (orders.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-muted">{title}</h2>
      <ul className="space-y-3">
        {orders.map((order) => {
          const live = order.tickets.filter((t) => (t.status === "VALID" || t.status === "CHECKED_IN") && !t.transferredAt).length;
          return (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className={`flex items-center gap-4 rounded-card border border-line bg-surface p-3 transition hover:border-brand/50 ${muted ? "opacity-70" : ""}`}
              >
                <Poster src={order.event.posterUrl} alt="" sizes="80px" className="w-16 shrink-0 rounded-lg md:w-20" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold">{order.event.title}</p>
                  <p className="text-sm text-muted">
                    {formatDateTime(order.event.startsAt)} · {order.event.venue.name}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Badge variant={order.status === "REFUNDED" ? "danger" : "soft"}>
                      {order.status === "REFUNDED" ? "Refunded" : `${live} ticket${live === 1 ? "" : "s"}`}
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
