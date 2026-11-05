"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type SignInState = { error?: string };

/** Only allow same-site relative redirects. */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/tickets";
}

export async function signInWithEmail(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = z.email().max(200).safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email." };
  if (!rateLimit(`signin:${await clientIp()}`, 5, 10 * 60_000).ok) {
    return { error: "Too many links requested. Try again in a few minutes." };
  }
  try {
    await signIn("resend", { email: parsed.data.toLowerCase(), redirectTo: safeNext(formData.get("next")) });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Couldn't send your link. Try again." };
    throw error; // NEXT_REDIRECT
  }
  return {};
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeNext(formData.get("next")) });
}

export async function signOutAction() {
  await signOut({ redirect: false });
  redirect("/");
}
