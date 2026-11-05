import { tokens } from "@/lib/tokens";
import { appUrl } from "@/lib/utils";

const c = tokens.colors;

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Dark, table-based shell that renders in Gmail, Outlook and Apple Mail. */
export function emailLayout({ preheader, body }: { preheader: string; body: string }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>Oflinewave</title></head>
<body style="margin:0;padding:0;background:${c.black};color:${c.white};font-family:Inter,Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.black};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding-bottom:24px;font-size:20px;font-weight:800;color:${c.orange};">
<img src="${appUrl("/brand/logo.png")}" alt="Oflinewave" width="136" height="40" style="display:block;border:0;height:40px;width:136px;"></td></tr>
${body}
<tr><td style="padding-top:32px;color:${c.muted};font-size:12px;line-height:1.6;">
Put the phone down. See you on the floor.<br>Oflinewave · Lagos</td></tr>
</table></td></tr></table></body></html>`;
}

export function emailButton(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:${c.orange};color:${c.black};font-weight:700;text-decoration:none;padding:14px 24px;border-radius:999px;">${escapeHtml(label)}</a>`;
}
