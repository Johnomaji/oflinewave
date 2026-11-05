import "server-only";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { defer } from "@/lib/defer";
import { formatDateTime } from "@/lib/dates";
import { emailLayout, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { sendTicketEmail } from "@/lib/email/tickets";
import { createQrToken, newQrNonce } from "@/lib/tickets/token";

export class TransferError extends Error {}

type WindowEvent = { transfersEnabled: boolean; transferCutoffHours: number; startsAt: Date };

/** When buyers may transfer or rename. Admins can always do it. */
export function transferDeadline(event: WindowEvent) {
  return new Date(event.startsAt.getTime() - event.transferCutoffHours * 3_600_000);
}

export function transferWindowOpen(event: WindowEvent, now = new Date()) {
  return event.transfersEnabled && now < transferDeadline(event);
}

type Actor = { kind: "holder" } | { kind: "admin"; userId: string };

async function loadTransferable(ticketId: string, actor: Actor) {
  const ticket = await db.ticket.findUnique({ where: { id: ticketId }, include: { order: true, event: true } });
  if (!ticket) throw new TransferError("Ticket not found.");
  if (ticket.order.status !== "PAID") throw new TransferError("Only paid tickets can be changed.");
  if (ticket.status !== "VALID") {
    throw new TransferError(ticket.status === "CHECKED_IN" ? "This ticket was already scanned in." : "This ticket is no longer valid.");
  }
  if (actor.kind === "holder" && !transferWindowOpen(ticket.event)) {
    throw new TransferError(
      ticket.event.transfersEnabled
        ? `Changes closed ${formatDateTime(transferDeadline(ticket.event))}. Contact us if you're stuck.`
        : "Transfers are switched off for this event.",
    );
  }
  return ticket;
}

/**
 * Hands a ticket to someone else. The QR is re-issued, so the previous
 * holder's screenshot or PDF stops scanning the moment this succeeds.
 */
export async function transferTicket(ticketId: string, to: { name: string; email: string }, actor: Actor) {
  const ticket = await loadTransferable(ticketId, actor);
  const toEmail = to.email.trim().toLowerCase();
  const toName = to.name.trim();
  if (toEmail === ticket.holderEmail) throw new TransferError("That's already the ticket holder. Use 'Change name' instead.");

  const qrToken = createQrToken(ticket.id, newQrNonce());
  const { count } = await db.ticket.updateMany({
    // Conditional on the old token: two simultaneous transfers can't both win.
    where: { id: ticket.id, status: "VALID", qrToken: ticket.qrToken },
    data: { holderName: toName, holderEmail: toEmail, qrToken, transferredAt: new Date() },
  });
  if (count === 0) throw new TransferError("This ticket just changed. Refresh and try again.");

  await db.ticketTransfer.create({
    data: {
      ticketId: ticket.id,
      kind: "TRANSFER",
      fromName: ticket.holderName,
      fromEmail: ticket.holderEmail,
      toName,
      toEmail,
      actorId: actor.kind === "admin" ? actor.userId : null,
    },
  });
  await audit(actor.kind === "admin" ? actor.userId : null, "ticket.transferred", "Ticket", ticket.id, {
    from: ticket.holderEmail,
    to: toEmail,
  });

  const fromName = ticket.holderName;
  const fromEmail = ticket.holderEmail;
  defer(() => sendTicketEmail(ticket.orderId, { ticketIds: [ticket.id], transferFrom: fromName }));
  defer(() =>
    sendEmail({
      to: fromEmail,
      subject: `Ticket sent: ${ticket.event.title}`,
      text: `You transferred your ${ticket.event.title} ticket (${ticket.code}) to ${toName}. Your old QR code no longer works.`,
      html: emailLayout({
        preheader: "Your ticket is on its way.",
        body: `<tr><td style="font-size:28px;font-weight:800;padding-bottom:12px;">Sent.</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#A3A3A3;">You passed your <strong style="color:#fff">${escapeHtml(ticket.event.title)}</strong> ticket (${ticket.code}) to ${escapeHtml(toName)}. Your old QR code no longer works.</td></tr>`,
      }),
    }),
  );
  return { qrToken };
}

/** Fixes the name printed on a ticket. Same QR; no re-issue needed. */
export async function renameTicket(ticketId: string, name: string, actor: Actor) {
  const ticket = await loadTransferable(ticketId, actor);
  const newName = name.trim();
  if (newName === ticket.holderName) return;
  await db.ticket.update({ where: { id: ticket.id }, data: { holderName: newName } });
  await db.ticketTransfer.create({
    data: {
      ticketId: ticket.id,
      kind: "NAME_CHANGE",
      fromName: ticket.holderName,
      fromEmail: ticket.holderEmail,
      toName: newName,
      toEmail: ticket.holderEmail,
      actorId: actor.kind === "admin" ? actor.userId : null,
    },
  });
  await audit(actor.kind === "admin" ? actor.userId : null, "ticket.renamed", "Ticket", ticket.id, { from: ticket.holderName, to: newName });
}
