import "server-only";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import { renderTicketsPdf } from "@/lib/tickets/pdf";
import { ticketViewToken } from "@/lib/tickets/token";
import { walletConfig } from "@/lib/tickets/wallet";
import { tokens } from "@/lib/tokens";
import { appUrl } from "@/lib/utils";
import { emailButton, emailLayout, escapeHtml } from "./layout";
import { sendEmail } from "./send";
import { getTemplates, renderTemplate } from "./templates";

const c = tokens.colors;

export async function loadOrderForTickets(orderId: string) {
  return db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      event: { include: { venue: true } },
      tickets: {
        where: { status: { in: ["VALID", "CHECKED_IN"] } },
        include: { tier: true },
        orderBy: { createdAt: "asc" },
      },
      addOns: { include: { addOn: true } },
    },
  });
}

type OrderForTickets = Awaited<ReturnType<typeof loadOrderForTickets>>;
type TicketRow = OrderForTickets["tickets"][number];

export function ticketsPdfFor(order: OrderForTickets, tickets: TicketRow[] = order.tickets) {
  return renderTicketsPdf(
    tickets.map((t) => ({
      code: t.code,
      qrToken: t.qrToken,
      holderName: t.holderName,
      tierName: t.tier.name,
      admits: t.tier.admits,
      eventTitle: order.event.title,
      startsAt: order.event.startsAt,
      venueName: order.event.venue.name,
      venueAddress: order.event.venue.address,
      orderReference: order.reference,
      addOns: tickets === order.tickets ? order.addOns.map((a) => `${a.quantity} × ${a.addOn.name}`) : [],
    })),
  );
}

function walletLinks(t: TicketRow) {
  const token = ticketViewToken(t.qrToken);
  const links: string[] = [];
  if (walletConfig.apple()) links.push(`<a href="${appUrl(`/api/tickets/${t.id}/wallet/apple?t=${token}`)}" style="color:${c.orange};font-size:12px;font-weight:600;">Add to Apple Wallet</a>`);
  if (walletConfig.google()) links.push(`<a href="${appUrl(`/api/tickets/${t.id}/wallet/google?t=${token}`)}" style="color:${c.orange};font-size:12px;font-weight:600;">Save to Google Wallet</a>`);
  return links.length ? `<div style="margin-top:10px;">${links.join(" &nbsp;·&nbsp; ")}</div>` : "";
}

function ticketBlock(t: TicketRow) {
  return `
<tr><td style="padding:0 0 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.surface};border:1px solid ${c.border};border-radius:16px;">
<tr><td style="padding:20px;" valign="top">
<div style="font-size:11px;letter-spacing:2px;color:${c.orange};font-weight:700;">${escapeHtml(t.tier.name.toUpperCase())}${t.tier.admits > 1 ? ` · ADMITS ${t.tier.admits}` : ""}</div>
<div style="font-size:18px;font-weight:700;margin-top:6px;">${escapeHtml(t.holderName)}</div>
<div style="font-size:13px;color:${c.muted};margin-top:4px;font-family:monospace;letter-spacing:2px;">${t.code}</div>
${walletLinks(t)}
</td><td width="150" style="padding:16px;" align="right">
<img src="${appUrl(`/api/qr/${encodeURIComponent(t.qrToken)}`)}" width="130" height="130" alt="QR code for ticket ${t.code}" style="display:block;border-radius:8px;background:#fff;">
</td></tr></table></td></tr>`;
}

/**
 * Ticket delivery + receipt. Safe to call again ("resend tickets").
 * With `ticketIds`, only those tickets are sent (e.g. to a transfer recipient).
 */
export async function sendTicketEmail(orderId: string, opts: { to?: string; ticketIds?: string[]; transferFrom?: string } = {}) {
  const order = await loadOrderForTickets(orderId);
  const tickets = opts.ticketIds ? order.tickets.filter((t) => opts.ticketIds!.includes(t.id)) : order.tickets.filter((t) => !t.transferredAt);
  if (tickets.length === 0) return;

  const { event } = order;
  const templates = await getTemplates();
  const isTransfer = Boolean(opts.transferFrom);
  const vars = {
    event: event.title,
    name: tickets[0].holderName,
    from: opts.transferFrom ?? "",
    date: formatDateTime(event.startsAt),
    venue: event.venue.name,
    reference: order.reference,
  };
  const copy = renderTemplate(isTransfer ? templates.transfer : templates.tickets, vars);

  // Transfer recipients get a single-ticket link; buyers get the order page.
  const viewUrl = isTransfer
    ? appUrl(`/tickets/${tickets[0].id}?t=${ticketViewToken(tickets[0].qrToken)}`)
    : appUrl(`/orders/${order.id}?t=${order.accessToken}`);

  const addOnLine =
    !isTransfer && order.addOns.length
      ? `<tr><td style="padding:0 0 16px;font-size:13px;color:${c.white};">Add-ons: ${order.addOns.map((a) => `${a.quantity} × ${escapeHtml(a.addOn.name)}`).join(", ")}. Show your QR to collect.</td></tr>`
      : "";
  const totals = isTransfer
    ? ""
    : `<tr><td style="padding:8px 0 24px;color:${c.muted};font-size:13px;">${order.total > 0 ? `Paid ${formatNaira(order.total)} · ` : ""}Order ${order.reference}</td></tr>`;

  const html = emailLayout({
    preheader: copy.subject,
    body: `
<tr><td style="font-size:32px;font-weight:800;letter-spacing:-0.03em;line-height:1.1;padding-bottom:12px;">${copy.headingHtml}</td></tr>
<tr><td style="font-size:16px;line-height:1.6;color:${c.white};padding-bottom:4px;"><strong>${escapeHtml(event.title)}</strong></td></tr>
<tr><td style="font-size:14px;line-height:1.6;color:${c.muted};padding-bottom:24px;">
${formatDateTime(event.startsAt)}<br>${escapeHtml(event.venue.name)}, ${escapeHtml(event.venue.address)}</td></tr>
${tickets.map(ticketBlock).join("")}
${addOnLine}
${totals}
<tr><td style="padding-bottom:16px;">${emailButton(viewUrl, isTransfer ? "View my ticket" : "View tickets")}</td></tr>
<tr><td>${copy.bodyHtml}</td></tr>`,
  });

  const text = [
    copy.headingText,
    `${event.title} · ${formatDateTime(event.startsAt)} · ${event.venue.name}, ${event.venue.address}`,
    "",
    ...tickets.map((t) => `- ${t.tier.name}: ${t.holderName} (${t.code})`),
    "",
    copy.bodyText,
    "",
    `View: ${viewUrl}`,
  ].join("\n");

  const pdf = await ticketsPdfFor(order, opts.ticketIds ? tickets : order.tickets.filter((t) => !t.transferredAt));

  await sendEmail({
    to: opts.to ?? (isTransfer ? tickets[0].holderEmail : order.buyerEmail),
    subject: copy.subject,
    html,
    text,
    attachments: [{ filename: `oflinewave-${order.reference}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
}
