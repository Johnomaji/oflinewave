"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { TooManyAttempts, signIn, signOut } from "@/lib/auth";
import { ADMIN_ROLES, SCAN_ROLES, getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isStaffEmail } from "@/lib/staff";
import { safeRedirectPath } from "@/lib/utils";

/** `staff` is set when an email-link request hit a staff account, so the form can point to password sign-in. */
export type SignInState = { error?: string; staff?: boolean };

const safeNext = (value: FormDataEntryValue | null) => safeRedirectPath(value);

function tryAgainIn(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

// Sign-in only runs through these actions: app/api/auth/[...nextauth]/route.ts closes Auth.js's own
// POST sign-in endpoints, so these limits can't be skipped.
export async function signInWithEmail(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = z.email().max(200).safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email." };
  const email = parsed.data.toLowerCase();
  if (!rateLimit(`signin:${await clientIp()}`, 5, 10 * 60_000).ok) {
    return { error: "Too many links requested. Try again in a few minutes." };
  }
  if (await isStaffEmail(email)) return { error: "This is a staff account, so it signs in with a password.", staff: true };
  // Per address too, so nobody can flood one inbox from many IPs.
  if (!rateLimit(`signin-email:${email}`, 3, 15 * 60_000).ok) {
    return { error: "We've sent a few links to that address already. Check your inbox, or try again in 15 minutes." };
  }
  try {
    await signIn("resend", { email, redirectTo: safeNext(formData.get("next")) });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Couldn't send your link. Try again." };
    throw error; // NEXT_REDIRECT
  }
  return {};
}

/** Staff sign-in. Without a `next`, admins land in /admin and door staff on the scanner. */
export async function signInWithPassword(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  // Rate limits are applied in the provider's authorize() (lib/auth.ts), counting failures only.

  let redirectTo = safeRedirectPath(formData.get("next"), "");
  if (!redirectTo) {
    const user = await db.user.findUnique({ where: { email }, select: { role: true } });
    redirectTo = user && ADMIN_ROLES.includes(user.role) ? "/admin" : "/scan";
  }
  try {
    await signIn("password", { email, password, redirectTo });
  } catch (error) {
    if (error instanceof TooManyAttempts) return { error: tryAgainIn(error.retryAfter) };
    if (error instanceof AuthError) return { error: "Wrong email or password." };
    throw error; // NEXT_REDIRECT
  }
  return {};
}

const newPasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    password: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`).max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "The new passwords don't match.", path: ["confirm"] })
  .refine((d) => d.password !== d.current, { message: "Choose a password different from the current one.", path: ["password"] });

export async function changePassword(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const session = await getCurrentUser();
  if (!session || !SCAN_ROLES.includes(session.role)) redirect("/login?staff=1");
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  if (!rateLimit(`password-change:${session.id}`, 8, 15 * 60_000).ok) return { error: "Too many attempts. Try again in a few minutes." };

  const user = await db.user.findUnique({ where: { id: session.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(parsed.data.current, user?.passwordHash))) return { error: "Your current password is wrong." };

  // Raising sessionVersion signs out every device, including any that knew the old password.
  await db.user.update({
    where: { id: session.id },
    data: { passwordHash: await hashPassword(parsed.data.password), mustChangePassword: false, sessionVersion: { increment: 1 } },
  });
  await audit(session.id, "auth.password_changed", "User", session.id);
  const next = safeRedirectPath(formData.get("next"), ADMIN_ROLES.includes(session.role) ? "/admin" : "/scan");

  // That signed this device out too, so sign it straight back in with the new password.
  try {
    await signIn("password", { email: session.email, password: parsed.data.password, redirectTo: next });
  } catch (error) {
    if (error instanceof AuthError) redirect(`/login?staff=1&next=${encodeURIComponent(next)}`);
    throw error; // NEXT_REDIRECT
  }
  return {}; // not reached: signIn redirects
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeNext(formData.get("next")) });
}

export async function signOutAction() {
  await signOut({ redirect: false });
  redirect("/");
}
