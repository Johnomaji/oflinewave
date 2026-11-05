import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";

export const SETTINGS_TAG = "settings";

/** Uncached read, for transactions and admin forms. */
export function readSettings() {
  return db.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/** Cached read, for public pages. */
export async function getSettings() {
  "use cache";
  cacheLife("hours");
  cacheTag(SETTINGS_TAG);
  return readSettings();
}
