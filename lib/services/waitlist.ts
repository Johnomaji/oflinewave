import "server-only";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { emailButton, emailLayout, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { getTemplates, renderTemplate } from "@/lib/email/templates";
import { tokens } from "@/lib/tokens";
import { appUrl } from "@/lib/utils";
import { getAvailability } from "./checkout";

const BATCH = 200;

/**
 * Emails waitlisted people (oldest first) when public tickets are available
 * again: after refunds, when a tier's quantity goes up, or on demand from admin.
 * Each person is emailed once (notifiedAt). First come, first in.
 */
export async function notifyWaitlist(eventId: string, actorId?: string | null) {
  const event = await db.event.findUnique({ where: { id: eventId }, include: { venue: true, tiers: true } });
  if (!event || event.status !== "PUBLISHED") return { sent: 0, reason: "Event isn't published." };
  const now = new Date();
  if ((event.endsAt ?? event.startsAt) < now) return { sent: 0, reason: "Event has ended." };

  const availability = await getAvailability(eventId);
  const open = event.tiers.some(
    (t) =>
      t.visibility === "PUBLIC" &&
      (availability[t.id] ?? 0) > 0 &&
      !(t.salesStart && t.salesStart > now) &&
      !(t.salesEnd && t.salesEnd < now),
  );
  if (!open) return { sent: 0, reason: "No public tickets are on sale right now." };

  const entries = await db.waitlistEntry.findMany({
    where: { eventId, notifiedAt: null },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  if (entries.length === 0) return { sent: 0, reason: "Nobody waiting." };

  const copy = renderTemplate((await getTemplates()).waitlist, {
    event: event.title,
    date: formatDateTime(event.startsAt),
    venue: event.venue.name,
  });
  const url = appUrl(`/events/${event.slug}/checkout`);
  const html = emailLayout({
    preheader: copy.subject,
    body: `
<tr><td style="font-size:32px;font-weight:800;letter-spacing:-0.03em;padding-bottom:12px;">${copy.headingHtml}</td></tr>
<tr><td style="font-size:16px;color:${tokens.colors.white};padding-bottom:4px;"><strong>${escapeHtml(event.title)}</strong></td></tr>
<tr><td style="font-size:14px;color:${tokens.colors.muted};padding-bottom:20px;">${formatDateTime(event.startsAt)} · ${escapeHtml(event.venue.name)}</td></tr>
<tr><td>${copy.bodyHtml}</td></tr>
<tr><td style="padding-top:12px;">${emailButton(url, "Get tickets")}</td></tr>`,
  });

  let sent = 0;
  for (const entry of entries) {
    // Claim first so concurrent runs never double-send.
    const { count } = await db.waitlistEntry.updateMany({ where: { id: entry.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
    if (count === 0) continue;
    try {
      await sendEmail({ to: entry.email, subject: copy.subject, html, text: `${copy.headingText}\n\n${copy.bodyText}\n\n${url}` });
      sent += 1;
    } catch (error) {
      await db.waitlistEntry.update({ where: { id: entry.id }, data: { notifiedAt: null } });
      console.error("[waitlist] send failed", entry.email, error);
    }
  }
  await audit(actorId ?? null, "waitlist.notified", "Event", eventId, { sent });
  return { sent, reason: null };
}
