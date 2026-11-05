import { randomBytes } from "node:crypto";

/** Collision-resistant id we can know before insert (needed to sign QR tokens). */
export function newId(prefix = "t") {
  return prefix + randomBytes(12).toString("hex");
}
