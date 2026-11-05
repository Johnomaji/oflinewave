"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type NewsletterState = { status: "idle" | "ok" | "error"; message?: string };

const schema = z.object({ email: z.email().max(200) });

export async function subscribe(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", message: "That email doesn't look right." };

  if (!rateLimit(`newsletter:${await clientIp()}`, 5, 60_000).ok) {
    return { status: "error", message: "Easy, tiger. Try again in a minute." };
  }

  const email = parsed.data.email.toLowerCase();
  await db.newsletterSubscriber.upsert({ where: { email }, update: {}, create: { email } });
  return { status: "ok", message: "You're on the list. First dibs on drops." };
}
