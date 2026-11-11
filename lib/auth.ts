import NextAuth, { CredentialsSignin } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { emailButton, emailLayout } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { getTemplates, renderTemplate } from "@/lib/email/templates";
import type { Role } from "@/lib/generated/prisma/enums";
import { verifyPassword } from "@/lib/password";
import { forgive, ipFromHeaders, rateLimit } from "@/lib/rate-limit";
import { isStaffEmail } from "@/lib/staff";

const SCAN_ROLES: Role[] = ["DOOR_STAFF", "ORGANIZER", "SUPER_ADMIN"];

/** Password sign-in refused for going over a limit, so the form can say so instead of "wrong password". */
export class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
  retryAfter: number;
  constructor(retryAfter: number) {
    super();
    this.retryAfter = retryAfter;
  }
}

// Behind a host's proxy (Hostinger) the request arrives as 0.0.0.0:3000, and Auth.js would build
// sign-in links and redirects from that. Pin it to the public URL instead.
process.env.AUTH_URL ||= process.env.APP_URL;

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

// Staff sign in with email + password. Customers can't: authorize only accepts staff accounts.
providers.push(
  Credentials({
    id: "password",
    name: "Password",
    credentials: { email: {}, password: {} },
    async authorize(credentials, request) {
      const email = typeof credentials.email === "string" ? credentials.email.trim().toLowerCase() : "";
      const password = typeof credentials.password === "string" ? credentials.password : "";
      if (!email || !password || password.length > 200) return null;

      // Only failed attempts count. Per IP stops one source trying many accounts (and running scrypt
      // on demand). Per account stops many sources trying one. Its window is an hour, not a day, so
      // nobody can lock an admin out for long.
      const keys = [`pw-ip:${ipFromHeaders(request.headers)}`, `pw-account:${email}`];
      const limits = [rateLimit(keys[0], 10, 15 * 60_000), rateLimit(keys[1], 10, 60 * 60_000)];
      const blocked = limits.filter((l) => !l.ok);
      if (blocked.length) throw new TooManyAttempts(Math.max(...blocked.map((l) => l.retryAfter)));

      const user = await db.user.findUnique({ where: { email } });
      const ok = await verifyPassword(password, user?.passwordHash);
      if (!user || !ok || !SCAN_ROLES.includes(user.role)) return null;

      keys.forEach(forgive);
      await db.staffMember.updateMany({ where: { email, acceptedAt: null }, data: { acceptedAt: new Date() } });
      return { id: user.id, email: user.email, name: user.name };
    },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db as unknown as Parameters<typeof PrismaAdapter>[0]),
  providers,
  // Password sign-in requires JWT sessions. Role, password state and session version are re-read
  // from the database on every request (lib/dal.ts), so removing someone or changing their password
  // takes effect at once.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", verifyRequest: "/login/check-email", error: "/login" },
  trustHost: true,
  callbacks: {
    async signIn({ account, user }) {
      // Email links and Google are for customers. Staff must use their password.
      if (account?.provider !== "password" && user.email && (await isStaffEmail(user.email))) return "/login?staff=1&error=UsePassword";
      return true;
    },
    async jwt({ token, user, account }) {
      // Only at sign-in (that's when `user` is set). Never refresh these on a session update: a
      // signed-out device could then re-validate itself.
      if (user?.id) {
        const row = await db.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true } });
        token.sv = row?.sessionVersion ?? 0;
        token.pw = account?.provider === "password";
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.sessionVersion = typeof token.sv === "number" ? token.sv : 0;
      session.viaPassword = token.pw === true;
      return session;
    },
  },
});
