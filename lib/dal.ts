import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@/lib/generated/prisma/enums";

export type CurrentUser = { id: string; email: string; name: string | null; role: Role; mustChangePassword: boolean };

export const ADMIN_ROLES: Role[] = ["ORGANIZER", "SUPER_ADMIN"];
export const SCAN_ROLES: Role[] = ["DOOR_STAFF", "ORGANIZER", "SUPER_ADMIN"];

/** Reads the session. Request-time only: call inside <Suspense> or a server action. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Auth.js touches crypto before reading cookies; mark this as request-time first.
  await connection();
  const session = await auth();
  if (!session?.user?.id) return null;
  // Sessions are JWTs, so read role and password state fresh: removing someone takes effect at once.
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, mustChangePassword: true, sessionVersion: true },
  });
  // A password or role change raises sessionVersion, which signs out every session from before it.
  if (!user || user.sessionVersion !== session.sessionVersion) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    // Staff access needs a password sign-in. An email-link or Google session only ever counts as a customer.
    role: session.viaPassword ? user.role : "ATTENDEE",
    mustChangePassword: user.mustChangePassword,
  };
});

/** Gate for pages and server actions. Every admin entry point must call this. */
export async function requireRole(roles: Role[], next = "/admin"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?staff=1&next=${encodeURIComponent(next)}`);
  if (!roles.includes(user.role)) redirect("/login?staff=1&error=forbidden");
  if (user.mustChangePassword) redirect(`/account/password?next=${encodeURIComponent(next)}`);
  return user;
}

export const requireAdmin = (next?: string) => requireRole(ADMIN_ROLES, next);
export const requireScanner = (next = "/scan") => requireRole(SCAN_ROLES, next);
// A temporary password must be replaced before any staff access: pages, actions and API routes alike.
export const isAdmin = (user: CurrentUser | null) => !!user && ADMIN_ROLES.includes(user.role) && !user.mustChangePassword;
export const canScan = (user: CurrentUser | null) => !!user && SCAN_ROLES.includes(user.role) && !user.mustChangePassword;
