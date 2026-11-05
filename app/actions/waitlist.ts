"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type WaitlistState = { status: "idle" | "ok" | "error"; message?: string };

const schema = z.object({
  eventId: z.string().min(1).max(40),
  email: z.email().max(200),
  name: z.string().trim().max(100).optional(),
});

export async function joinWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const parsed = schema.safeParse({
    eventId: formData.get("eventId"),
    email: formData.get("email"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) return { status: "error", message: "Check your email and try again." };
  if (!rateLimit(`waitlist:${await clientIp()}`, 5, 60_000).ok) {
    return { status: "error", message: "Too many tries. Give it a minute." };
  }

  const event = await db.event.findFirst({ where: { id: parsed.data.eventId, status: "PUBLISHED" }, select: { id: true } });
  if (!event) return { status: "error", message: "This event isn't taking a waitlist." };

  const email = parsed.data.email.toLowerCase();
  await db.waitlistEntry.upsert({
    where: { eventId_email: { eventId: event.id, email } },
    update: {},
    create: { eventId: event.id, email, name: parsed.data.name },
  });
  return { status: "ok", message: "You're on the waitlist. We'll email you the second tickets free up." };
}
