import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";
import { qrSvg } from "@/lib/tickets/qr";

type TicketCardProps = {
  ticket: { code: string; qrToken: string; holderName: string; status: string; checkedInAt: Date | null; tier: { name: string; admits: number } };
  event: { title: string; startsAt: Date; venue: { name: string } };
  /** Actions under the ticket (transfer, wallet…) */
  footer?: ReactNode;
  /** Ticket now belongs to someone else: hide the QR. */
  transferredTo?: string | null;
};

const STATUS: Record<string, { label: string; variant: "success" | "neutral" | "danger" }> = {
  VALID: { label: "Valid", variant: "success" },
  CHECKED_IN: { label: "Checked in", variant: "neutral" },
  REFUNDED: { label: "Refunded", variant: "danger" },
  CANCELLED: { label: "Cancelled", variant: "danger" },
};

/** Wallet-style ticket: orange band, QR on white, perforation. */
export async function TicketCard({ ticket, event, footer, transferredTo }: TicketCardProps) {
  const live = ticket.status === "VALID" && !transferredTo;
  const svg = live ? await qrSvg(ticket.qrToken) : null;
  const status = STATUS[ticket.status] ?? STATUS.VALID;

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface" aria-label={`Ticket for ${ticket.holderName}`}>
      <div className="flex items-start justify-between gap-3 bg-brand px-5 py-4 text-ink">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]">
            {ticket.tier.name}
            {ticket.tier.admits > 1 && ` · admits ${ticket.tier.admits}`}
          </p>
          <p className="truncate font-display text-xl font-extrabold">{event.title}</p>
        </div>
        <Badge variant={status.variant} className="shrink-0 bg-ink/90">
          {status.label}
        </Badge>
      </div>
      <div className="relative border-b border-dashed border-line">
        <span className="absolute -left-3 -top-3 size-6 rounded-full bg-ink" aria-hidden />
        <span className="absolute -right-3 -top-3 size-6 rounded-full bg-ink" aria-hidden />
      </div>
      <div className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-center">
        {svg ? (
          <div
            className="size-48 shrink-0 rounded-xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
            role="img"
            aria-label={`QR code for ticket ${ticket.code}`}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="grid size-48 shrink-0 place-items-center rounded-xl border border-dashed border-line text-center text-sm text-muted">
            {transferredTo ? `Transferred to ${transferredTo}` : ticket.status === "CHECKED_IN" && ticket.checkedInAt ? `Scanned ${formatDateTime(ticket.checkedInAt)}` : "QR disabled"}
          </div>
        )}
        <dl className="w-full space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Name</dt>
            <dd className="font-semibold">{ticket.holderName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">When</dt>
            <dd className="font-semibold">{formatDateTime(event.startsAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Where</dt>
            <dd className="font-semibold">{event.venue.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Ticket code</dt>
            <dd className="font-mono text-base font-bold tracking-[0.2em] text-brand">{ticket.code}</dd>
          </div>
        </dl>
      </div>
      {footer && <div className="space-y-3 border-t border-line p-5">{footer}</div>}
    </article>
  );
}
