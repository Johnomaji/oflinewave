import "server-only";
import { db } from "@/lib/db";

/** SUPER_ADMIN_EMAIL may list several addresses, comma-separated. */
export const superAdminEmails = (process.env.SUPER_ADMIN_EMAIL ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Staff (door staff, organizers, admins) sign in with a password only. This tells the email-link
 * and Google flows to turn them away. Includes SUPER_ADMIN_EMAIL before its account exists.
 */
export async function isStaffEmail(email: string) {
  const normalized = email.toLowerCase();
  if (superAdminEmails.includes(normalized)) return true;
  const [user, invite] = await Promise.all([
    db.user.findUnique({ where: { email: normalized }, select: { role: true } }),
    db.staffMember.findUnique({ where: { email: normalized }, select: { id: true } }),
  ]);
  return Boolean(invite) || (!!user && user.role !== "ATTENDEE");
}
