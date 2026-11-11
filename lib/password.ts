import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

const N = 2 ** 15;
const PARAMS = { N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

export const MIN_PASSWORD_LENGTH = 8;

/** Stored as `scrypt$N$salt$hash` (base64), so the cost can be raised later without breaking old hashes. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN, PARAMS);
  return `scrypt$${N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  // Hash anyway when there's no account, so a wrong email takes as long as a wrong password.
  const [scheme, n, saltB64, hashB64] = (stored ?? `scrypt$${N}$${randomBytes(16).toString("base64")}$`).split("$");
  if (scheme !== "scrypt") return false;
  const expected = Buffer.from(hashB64 ?? "", "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), KEYLEN, { ...PARAMS, N: Number(n) });
  return expected.length === KEYLEN && timingSafeEqual(actual, expected);
}
