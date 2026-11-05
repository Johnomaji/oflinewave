import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TicketActions } from "@/components/site/ticket-actions";
import { TicketCard } from "@/components/site/ticket-card";
import { WalletButtons } from "@/components/site/wallet-buttons";
import { formatDateTime } from "@/lib/dates";
import { getAuthorizedTicket } from "@/lib/data/tickets";
import { transferDeadline, transferWindowOpen } from "@/lib/services/transfers";

export const metadata: Metadata = { title: "Your ticket", robots: { index: false } };

/** One ticket, for its current holder (e.g. someone it was transferred to). */
export default function TicketPage(props: PageProps<"/tickets/[id]">) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 md:py-16">
      <Suspense
        fallback={
          <div className="flex items-center gap-3 text-muted">
            <Loader2 className="animate-spin" /> Loading your ticket…
          </div>
        }
      >
        <SingleTicket {...props} />
      </Suspense>
    </div>
  );
}

async function SingleTicket({ params, searchParams }: PageProps<"/tickets/[id]">) {
  await connection();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.t === "string" ? sp.t : undefined;
  const ticket = await getAuthorizedTicket(id, { ticketToken: token });
  if (!ticket || ticket.order.status !== "PAID") notFound();

  const { event } = ticket;
  const live = ticket.status === "VALID";
  const pdfHref = `/api/tickets/${ticket.id}/pdf${token ? `?t=${encodeURIComponent(token)}` : ""}`;
  const lastTransfer = ticket.transfers.find((t) => t.kind === "TRANSFER" && t.toEmail === ticket.holderEmail);

  return (
    <>
      <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-brand">Your ticket</p>
      <h1 className="mt-3 text-center text-5xl font-extrabold leading-[0.9]">{event.title}</h1>
      {lastTransfer && <p className="mt-3 text-center text-muted">From {lastTransfer.fromName}. It&apos;s yours now.</p>}
      <div className="mt-8">
        <TicketCard
          ticket={ticket}
          event={event}
          footer={
            live ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={pdfHref}>
                      <Download /> PDF
                    </a>
                  </Button>
                </div>
                <WalletButtons ticketId={ticket.id} qrToken={ticket.qrToken} />
                <TicketActions
                  ticketId={ticket.id}
                  credentials={{ ticketToken: token }}
                  holderName={ticket.holderName}
                  windowOpen={transferWindowOpen(event)}
                  closesLabel={event.transfersEnabled ? `Transfers close ${formatDateTime(transferDeadline(event))}` : null}
                />
              </>
            ) : null
          }
        />
      </div>
      <p className="mt-8 text-center text-sm text-muted">
        <Link href={`/events/${event.slug}`} className="text-brand hover:underline">
          Event details
        </Link>{" "}
        · Sign in with this email to see it in{" "}
        <Link href="/tickets" className="text-brand hover:underline">
          My tickets
        </Link>
      </p>
    </>
  );
}
