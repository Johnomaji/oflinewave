import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function audit(
  actorId: string | null | undefined,
  action: string,
  entity: string,
  entityId: string,
  data?: Prisma.InputJsonValue,
) {
  try {
    await db.auditLog.create({ data: { actorId: actorId ?? null, action, entity, entityId, data } });
  } catch (error) {
    // Audit logging must never break the action being audited.
    console.error("[audit] failed to write", action, entityId, error);
  }
}
