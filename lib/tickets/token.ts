import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * QR payload formats:
 *   OW1.<ticketId>.<signature>            original issue
 *   OW1.<ticketId>.<nonce>.<signature>    re-issued (after a transfer)
 *
 * The ticket id is random and the signature is an HMAC over id (+ nonce), so
 * tokens can't be guessed or forged. Check-in also requires the token to match
 * the one stored on the ticket, so re-issuing a QR retires the old one.
 */
const PREFIX = "OW1";

function secret() {
  const s = process.env.TICKET_SIGNING_SECRET;
  if (!s || s.length < 32) throw new Error("TICKET_SIGNING_SECRET must be set (32+ chars)");
  return s;
}

function hmac(value: string, length = 32) {
  return createHmac("sha256", secret()).update(value).digest("base64url").slice(0, length);
}

function sign(ticketId: string, nonce?: string) {
  return hmac(nonce ? `ticket:${ticketId}:${nonce}` : `ticket:${ticketId}`);
}

/** Pass a nonce to re-issue a ticket's QR (old QR stops scanning). */
export function createQrToken(ticketId: string, nonce?: string) {
  return nonce ? `${PREFIX}.${ticketId}.${nonce}.${sign(ticketId, nonce)}` : `${PREFIX}.${ticketId}.${sign(ticketId)}`;
}

export function newQrNonce() {
  return randomBytes(6).toString("base64url");
}

/** Returns the ticket id if the token's signature is authentic, otherwise null. */
export function verifyQrToken(token: string): string | null {
  const parts = token.trim().split(".");
  if ((parts.length !== 3 && parts.length !== 4) || parts[0] !== PREFIX) return null;
  const ticketId = parts[1];
  const nonce = parts.length === 4 ? parts[2] : undefined;
  const signature = parts[parts.length - 1];
  if (!/^[a-z0-9]{10,40}$/i.test(ticketId)) return null;
  if (nonce !== undefined && !/^[A-Za-z0-9_-]{4,16}$/.test(nonce)) return null;
  const expected = Buffer.from(sign(ticketId, nonce));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return ticketId;
}

/** Secret for viewing a single ticket (link in transfer emails). Rotates with the QR. */
export function ticketViewToken(qrToken: string) {
  return hmac(`view:${qrToken}`, 24);
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Short fingerprint of the current QR, so offline scanners can spot retired codes. */
export function qrFingerprint(qrToken: string) {
  return qrToken.slice(-8);
}

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I

/** Short human-readable code, printed on the ticket for manual lookup. */
export function createTicketCode(length = 8) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function createOrderReference() {
  return `OW-${createTicketCode(8)}`;
}

export function createAccessToken() {
  return randomBytes(24).toString("base64url");
}
