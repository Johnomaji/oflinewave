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
  const { data, error } = await client.emails.send({
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
  });
  if (error) throw new Error(`Email send failed: ${error.message}`);
  return { id: data?.id ?? "" };
}
