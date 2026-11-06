import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { emailButton, emailLayout } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { getTemplates, renderTemplate } from "@/lib/email/templates";
import type { Role } from "@/lib/generated/prisma/enums";

const providers: Provider[] = [
  Resend({
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM ?? "Oflinewave <tickets@oflinewave.com>",
    // Route through our email layer so dev works without a Resend key.
    async sendVerificationRequest({ identifier, url }) {
      const copy = renderTemplate((await getTemplates()).signIn, {});
      await sendEmail({
        to: identifier,
        subject: copy.subject,
        text: `${copy.headingText}\n\nTap to sign in: ${url}\n\n${copy.bodyText}`,
        html: emailLayout({
          preheader: copy.subject,
          body: `
<tr><td style="font-size:28px;font-weight:800;padding-bottom:12px;">${copy.headingHtml}</td></tr>
<tr><td style="padding-bottom:24px;">${emailButton(url, "Sign in to Oflinewave")}</td></tr>
<tr><td>${copy.bodyHtml}</td></tr>`,
        }),
      });
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push(Google);

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

/** SUPER_ADMIN_EMAIL may list several addresses, comma-separated. */
const superAdminEmails = (process.env.SUPER_ADMIN_EMAIL ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Apply invites and the bootstrap super admins on every sign-in. */
async function syncRole(userId: string, email: string) {
  const normalized = email.toLowerCase();
  if (superAdminEmails.includes(normalized)) {
    await db.user.update({ where: { id: userId }, data: { role: "SUPER_ADMIN" } });
    return;
  }
  const invite = await db.staffMember.findUnique({ where: { email: normalized } });
  if (invite) {
    await db.user.update({ where: { id: userId }, data: { role: invite.role } });
    if (!invite.acceptedAt) await db.staffMember.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db as unknown as Parameters<typeof PrismaAdapter>[0]),
  providers,
  session: { strategy: "database" },
  pages: { signIn: "/login", verifyRequest: "/login/check-email", error: "/login" },
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = (user as unknown as { role: Role }).role;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.id && user.email) await syncRole(user.id, user.email);
    },
  },
});
