import "server-only";
import { readSettings } from "@/lib/settings";
import { escapeHtml } from "./layout";

/**
 * Editable email copy. Admins change subject / heading / body text in Settings;
 * the HTML structure, ticket blocks and buttons stay in code. Values from the
 * database are always escaped, so a template can't inject markup.
 */
export type TemplateKey = "tickets" | "signIn" | "waitlist" | "transfer";
export type EmailTemplate = { subject: string; heading: string; body: string };

export const TEMPLATE_META: Record<TemplateKey, { label: string; placeholders: string[] }> = {
  tickets: { label: "Ticket delivery", placeholders: ["event", "name", "date", "venue", "reference"] },
  signIn: { label: "Sign-in link", placeholders: [] },
  waitlist: { label: "Waitlist: tickets available", placeholders: ["event", "date", "venue"] },
  transfer: { label: "Ticket received (transfer)", placeholders: ["event", "from", "name", "date", "venue"] },
};

export const DEFAULT_TEMPLATES: Record<TemplateKey, EmailTemplate> = {
  tickets: {
    subject: "Your tickets: {{event}}",
    heading: "You're in. 🌊",
    body: "Show the QR at the door. Each code scans once.\n\nYour tickets are also attached as a PDF.",
  },
  signIn: {
    subject: "Your Oflinewave sign-in link",
    heading: "Tap in.",
    body: "One tap and you're signed in. The link expires in 24 hours.\n\nDidn't ask for this? Ignore it, nothing happens.",
  },
  waitlist: {
    subject: "Tickets just freed up: {{event}}",
    heading: "You're up.",
    body: "Tickets for {{event}} are back on sale. First come, first in, so move quick.",
  },
  transfer: {
    subject: "{{from}} sent you a ticket to {{event}}",
    heading: "A ticket, for you.",
    body: "{{from}} passed their ticket to you. It's yours now: show the QR at the door.",
  },
};

export async function getTemplates(): Promise<Record<TemplateKey, EmailTemplate>> {
  const settings = await readSettings();
  const saved = (settings.emailTemplates ?? {}) as Partial<Record<TemplateKey, Partial<EmailTemplate>>>;
  const merged = {} as Record<TemplateKey, EmailTemplate>;
  for (const key of Object.keys(DEFAULT_TEMPLATES) as TemplateKey[]) {
    const custom = saved[key] ?? {};
    merged[key] = {
      subject: custom.subject?.trim() || DEFAULT_TEMPLATES[key].subject,
      heading: custom.heading?.trim() || DEFAULT_TEMPLATES[key].heading,
      body: custom.body?.trim() || DEFAULT_TEMPLATES[key].body,
    };
  }
  return merged;
}

export type TemplateVars = Partial<Record<string, string>>;

/** Fill {{placeholders}} as plain text (subjects, text emails). Unknown ones are left blank. */
export function fillText(template: string, vars: TemplateVars) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

/** Fill placeholders and turn blank-line paragraphs into escaped HTML <p>s. */
export function fillHtmlParagraphs(template: string, vars: TemplateVars, style: string) {
  return fillText(template, vars)
    .split(/\n{2,}/)
    .map((p) => `<p style="${style}">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Render a template's three parts for an email. */
export function renderTemplate(t: EmailTemplate, vars: TemplateVars) {
  return {
    subject: fillText(t.subject, vars),
    headingHtml: escapeHtml(fillText(t.heading, vars)),
    bodyHtml: fillHtmlParagraphs(t.body, vars, "margin:0 0 12px;font-size:14px;line-height:1.6;color:#A3A3A3;"),
    bodyText: fillText(t.body, vars),
    headingText: fillText(t.heading, vars),
  };
}
