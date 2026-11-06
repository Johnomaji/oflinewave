import "server-only";
import { Resend } from "resend";

export type EmailAttachment = { filename: string; content: Buffer; contentType?: string };
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
};

let client: Resend | null = null;

// Resend allows 10 requests a second per team. Space sends out (8/s) so a ticket rush
// queues instead of failing, and back off if another process still trips the limit.
const SEND_INTERVAL_MS = 125;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
let nextSendAt = 0;

async function waitForSendSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextSendAt);
  nextSendAt = slot + SEND_INTERVAL_MS;
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
}

/**
 * Sends via Resend when RESEND_API_KEY is set. In development without a key,
 * the message is logged to the server console instead so flows stay testable.
 */
export async function sendEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set");
    console.info(
      `\n📧 [email:dev] to=${message.to} subject="${message.subject}"` +
        (message.attachments?.length ? ` attachments=${message.attachments.map((a) => a.filename).join(",")}` : "") +
        `\n${message.text}\n`,
    );
    return { id: "dev" };
  }

  client ??= new Resend(apiKey);
  const payload = {
    from: process.env.EMAIL_FROM ?? "Oflinewave <tickets@oflinewave.com>",
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    attachments: message.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  };
  for (let attempt = 0; ; attempt++) {
    await waitForSendSlot();
    const { data, error } = await client.emails.send(payload);
    if (!error) return { id: data?.id ?? "" };
    if (error.name !== "rate_limit_exceeded" || attempt >= RETRY_DELAYS_MS.length) {
      throw new Error(`Email send failed: ${error.message}`);
    }
    // Jitter so a burst of retries doesn't collide again.
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt] * (0.5 + Math.random())));
  }
}
