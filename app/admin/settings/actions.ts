"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/app/admin/orders/actions";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { emailLayout } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { getTemplates, renderTemplate } from "@/lib/email/templates";
import { nairaToKobo } from "@/lib/money";
import { MIN_PASSWORD_LENGTH, hashPassword } from "@/lib/password";
import { SETTINGS_TAG } from "@/lib/settings";

const optionalUrl = z.url().max(300).optional().or(z.literal("").transform(() => undefined));

const settingsSchema = z.object({
  brandName: z.string().trim().min(1).max(60),
  contactEmail: z.email().max(200),
  feePercent: z.coerce.number().min(0).max(30),
  feeFlatNaira: z.coerce.number().min(0).max(100_000),
  defaultFeeMode: z.enum(["PASS_TO_BUYER", "ABSORB"]),
  instagramUrl: optionalUrl,
  twitterUrl: optionalUrl,
  tiktokUrl: optionalUrl,
});

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole(["SUPER_ADMIN"], "/admin/settings");
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  const data = {
    brandName: d.brandName,
    contactEmail: d.contactEmail,
    feePercentBps: Math.round(d.feePercent * 100),
    feeFlat: nairaToKobo(d.feeFlatNaira),
    defaultFeeMode: d.defaultFeeMode,
    instagramUrl: d.instagramUrl ?? null,
    twitterUrl: d.twitterUrl ?? null,
    tiktokUrl: d.tiktokUrl ?? null,
  };
  await db.setting.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  await audit(user.id, "settings.updated", "Setting", "1", data);
  updateTag(SETTINGS_TAG);
  return { ok: "Settings saved." };
}

const inviteSchema = z.object({
  email: z.email().max(200),
  role: z.enum(["DOOR_STAFF", "ORGANIZER", "SUPER_ADMIN", "ATTENDEE"]),
  password: z
    .string()
    .max(200)
    .refine((p) => p === "" || p.length >= MIN_PASSWORD_LENGTH, `Temporary password: at least ${MIN_PASSWORD_LENGTH} characters.`)
    .optional(),
});

/**
 * Add or change a team member. ATTENDEE removes staff access (and their password).
 * A temporary password is required for someone new; they must change it on first sign-in.
 */
export async function setStaffRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["SUPER_ADMIN"], "/admin/settings");
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const email = parsed.data.email.toLowerCase();
  const { role, password } = parsed.data;
  if (email === actor.email && role !== "SUPER_ADMIN") return { error: "You can't demote yourself." };

  if (role === "ATTENDEE") {
    await db.staffMember.deleteMany({ where: { email } });
    // Raising sessionVersion signs them out everywhere.
    await db.user.updateMany({ where: { email }, data: { role, passwordHash: null, mustChangePassword: false, sessionVersion: { increment: 1 } } });
    await audit(actor.id, "team.role_set", "StaffMember", email, { role });
    revalidatePath("/admin/settings");
    return { ok: `${email} removed from the team.` };
  }

  const existing = await db.user.findUnique({ where: { email }, select: { role: true, passwordHash: true } });
  if (!password && !existing?.passwordHash) return { error: "Set a temporary password for them to sign in with." };
  const passwordData = password ? { passwordHash: await hashPassword(password), mustChangePassword: true } : {};
  // A new role or password signs them out everywhere, so no older session keeps (or gains) access.
  const signOutEverywhere = existing && (existing.role !== role || !!password) ? { sessionVersion: { increment: 1 } } : {};

  await db.staffMember.upsert({ where: { email }, update: { role }, create: { email, role, invitedById: actor.id } });
  await db.user.upsert({
    where: { email },
    update: { role, ...passwordData, ...signOutEverywhere },
    create: { email, role, ...passwordData },
  });
  await audit(actor.id, "team.role_set", "StaffMember", email, { role, passwordReset: Boolean(password) });
  revalidatePath("/admin/settings");
  const roleName = role.replace("_", " ").toLowerCase();
  return {
    ok: password
      ? `${email} is now ${roleName}. Give them the temporary password; they'll choose their own when they first sign in (Staff tab on /login).`
      : `${email} is now ${roleName}.`,
  };
}

const templateSchema = z.object({
  subject: z.string().trim().max(150),
  heading: z.string().trim().max(120),
  body: z.string().trim().max(2000),
});
const TEMPLATE_KEYS = ["tickets", "signIn", "waitlist", "transfer"] as const;

/** Saves editable email copy. Blank fields fall back to the built-in default. */
export async function saveEmailTemplates(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole(["SUPER_ADMIN"], "/admin/settings");
  const templates: Record<string, z.infer<typeof templateSchema>> = {};
  for (const key of TEMPLATE_KEYS) {
    const parsed = templateSchema.safeParse({
      subject: formData.get(`${key}.subject`) ?? "",
      heading: formData.get(`${key}.heading`) ?? "",
      body: formData.get(`${key}.body`) ?? "",
    });
    if (!parsed.success) return { error: `${key}: ${parsed.error.issues[0]?.message}` };
    templates[key] = parsed.data;
  }
  await db.setting.upsert({ where: { id: 1 }, update: { emailTemplates: templates }, create: { id: 1, emailTemplates: templates } });
  await audit(user.id, "settings.email_templates", "Setting", "1");
  return { ok: "Email copy saved. New emails use it straight away." };
}

/** Sends a sample of one template to the admin, with made-up event details. */
export async function sendTestEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole(["SUPER_ADMIN"], "/admin/settings");
  const key = TEMPLATE_KEYS.find((k) => k === formData.get("template"));
  if (!key) return { error: "Unknown template." };
  const copy = renderTemplate((await getTemplates())[key], {
    event: "Shut Up & Dance 2.0",
    name: user.name ?? "Test Raver",
    from: "Ada",
    date: "Sat 28 Nov, 22:00",
    venue: "Warehouse 9",
    reference: "OW-SAMPLE1",
  });
  await sendEmail({
    to: user.email,
    subject: `[Test] ${copy.subject}`,
    text: `${copy.headingText}\n\n${copy.bodyText}`,
    html: emailLayout({
      preheader: copy.subject,
      body: `<tr><td style="font-size:32px;font-weight:800;padding-bottom:12px;">${copy.headingHtml}</td></tr><tr><td>${copy.bodyHtml}</td></tr>`,
    }),
  });
  return { ok: `Test sent to ${user.email}.` };
}
