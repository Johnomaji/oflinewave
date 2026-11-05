import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarPlus, Download, Loader2, XCircle } from "lucide-react";
import { retryPayment } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { PendingRefresher } from "@/components/site/pending-refresher";
import { TicketActions } from "@/components/site/ticket-actions";
import { TicketCard } from "@/components/site/ticket-card";
import { WalletButtons } from "@/components/site/wallet-buttons";
import { WaveLine } from "@/components/site/wave";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatDateTime } from "@/lib/dates";
import { getAuthorizedOrder } from "@/lib/data/orders";
import { formatNaira } from "@/lib/money";
import { reconcileOrder } from "@/lib/services/fulfillment";
import { transferDeadline, transferWindowOpen } from "@/lib/services/transfers";
import { appUrl } from "@/lib/utils";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default function OrderPage(props: PageProps<"/orders/[id]">) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:py-16">
      <Suspense
        fallback={
          <div className="flex items-center gap-3 text-muted">
            <Loader2 className="animate-spin" /> Loading your order…
          </div>
        }
      >
        <Order {...props} />
      </Suspense>
    </div>
  );
}

async function Order({ params, searchParams }: PageProps<"/orders/[id]">) {
  await connection();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.t === "string" ? sp.t : undefined;

  let order = await getAuthorizedOrder(id, token);
  if (!order) notFound();

  if (order.status === "PENDING" && sp.verify) {
    await reconcileOrder(order.id);
    order = (await getAuthorizedOrder(id, token))!;
  }

  const { event } = order;

  if (order.status === "PENDING") {
    const holdActive = order.holdExpiresAt && order.holdExpiresAt > new Date();
    return (
      <div className="text-center">
        <PendingRefresher />
        <Loader2 className="mx-auto size-10 animate-spin text-brand" />
        <h1 className="mt-6 text-4xl font-extrabold">Confirming your payment…</h1>
        <p className="mt-3 text-muted">This usually takes a few seconds. Keep this page open.</p>
        {holdActive && (
          <form action={retryPayment} className="mt-8">
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="token" value={token ?? ""} />
            <p className="mb-3 text-sm text-muted">Didn&apos;t finish paying?</p>
            <Button variant="outline">Pay {formatNaira(order.total)} now</Button>
          </form>
        )}
      </div>
    );
  }

  if (order.status === "FAILED" || order.status === "CANCELLED") {
    return (
      <div className="text-center">
        <XCircle className="mx-auto size-12 text-danger" />
        <h1 className="mt-6 text-4xl font-extrabold">Payment didn&apos;t go through.</h1>
        <p className="mt-3 text-muted">No money was taken. Your tickets were released. Give it another go.</p>
        <Button asChild size="lg" className="mt-8">
          <Link href={`/events/${event.slug}/checkout`}>Try again</Link>
        </Button>
      </div>
    );
  }

  const location = `${event.venue.name}, ${event.venue.address}`;
  const windowOpen = transferWindowOpen(event);
  const closesLabel = event.transfersEnabled ? `Transfers close ${formatDateTime(transferDeadline(event))}` : null;
  const pdfHref = `/api/orders/${order.id}/pdf${token ? `?t=${encodeURIComponent(token)}` : ""}`;

  return (
    <>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand">
          {order.status === "REFUNDED" ? "Refunded" : `Order ${order.reference}`}
        </p>
        <h1 className="mt-3 text-5xl font-extrabold leading-[0.9] md:text-7xl">
          {order.status === "REFUNDED" ? "This order was refunded." : (
            <>
              You&apos;re in. <span className="text-brand text-glow">See you on the floor.</span>
            </>
          )}
        </h1>
        <p className="mt-4 text-muted">
          {event.title} · {formatDateTime(event.startsAt)} · {event.venue.name}
        </p>
        {order.status === "PAID" && (
          <p className="mt-2 text-sm text-muted">
            Tickets also sent to <span className="text-white">{order.buyerEmail}</span>.
          </p>
        )}
      </div>
      <WaveLine className="my-8 h-10" />

      {order.status === "PAID" && (
        <div className="mb-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <a href={pdfHref}>
              <Download /> Download PDF
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href={googleCalendarUrl({
                title: event.title,
                description: event.tagline ?? event.title,
                location,
                startsAt: event.startsAt,
                endsAt: event.endsAt,
                url: appUrl(`/events/${event.slug}`),
              })}
              target="_blank"
              rel="noopener noreferrer"
            >
              <CalendarPlus /> Add to calendar
            </a>
          </Button>
        </div>
      )}

      <div className="space-y-5">
        {order.tickets.map((ticket) => {
          const transferredTo = ticket.transferredAt ? ticket.holderName : null;
          const live = order.status === "PAID" && ticket.status === "VALID" && !transferredTo;
          return (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              event={event}
              transferredTo={transferredTo}
              footer={
                live ? (
                  <>
                    <WalletButtons ticketId={ticket.id} qrToken={ticket.qrToken} />
                    <TicketActions
                      ticketId={ticket.id}
                      credentials={{ orderToken: token }}
                      holderName={ticket.holderName}
                      windowOpen={windowOpen}
                      closesLabel={closesLabel}
                    />
                  </>
                ) : null
              }
            />
          );
        })}
      </div>

      <dl className="mt-10 space-y-2 rounded-card border border-line bg-surface p-5 text-sm">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between">
            <dt className="text-muted">
              {item.quantity} × {item.tier.name}
            </dt>
            <dd>{formatNaira(item.unitPrice * item.quantity)}</dd>
          </div>
        ))}
        {order.addOns.map((a) => (
          <div key={a.id} className="flex justify-between">
            <dt className="text-muted">
              {a.quantity} × {a.addOn.name}
            </dt>
            <dd>{formatNaira(a.unitPrice * a.quantity)}</dd>
          </div>
        ))}
        {order.discount > 0 && (
          <div className="flex justify-between text-success">
            <dt>Discount</dt>
            <dd>−{formatNaira(order.discount)}</dd>
          </div>
        )}
        {order.fees > 0 && order.feeMode === "PASS_TO_BUYER" && (
          <div className="flex justify-between">
            <dt className="text-muted">Service fee</dt>
            <dd>{formatNaira(order.fees)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-2 font-bold">
          <dt>Total paid</dt>
          <dd>{order.total === 0 ? "Free" : formatNaira(order.total)}</dd>
        </div>
      </dl>
      <p className="mt-6 text-center text-sm text-muted">
        Bookmark this page or find it later in{" "}
        <Link href="/tickets" className="text-brand hover:underline">
          My tickets
        </Link>
        .
      </p>
    </>
  );
}
