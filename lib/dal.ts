import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/generated/prisma/enums";

export type CurrentUser = { id: string; email: string; name: string | null; role: Role };

export const ADMIN_ROLES: Role[] = ["ORGANIZER", "SUPER_ADMIN"];
export const SCAN_ROLES: Role[] = ["DOOR_STAFF", "ORGANIZER", "SUPER_ADMIN"];

/** Reads the session. Request-time only: call inside <Suspense> or a server action. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Auth.js touches crypto before reading cookies; mark this as request-time first.
  await connection();
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name ?? null, role: session.user.role };
});

/** Gate for pages and server actions. Every admin entry point must call this. */
export async function requireRole(roles: Role[], next = "/admin"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!roles.includes(user.role)) redirect("/login?error=forbidden");
  return user;
}

export const requireAdmin = (next?: string) => requireRole(ADMIN_ROLES, next);
export const requireScanner = (next = "/scan") => requireRole(SCAN_ROLES, next);
export const isAdmin = (user: CurrentUser | null) => !!user && ADMIN_ROLES.includes(user.role);
export const canScan = (user: CurrentUser | null) => !!user && SCAN_ROLES.includes(user.role);
