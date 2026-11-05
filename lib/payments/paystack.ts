import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider, VerifyResult, WebhookEvent } from "./types";

const API = "https://api.paystack.co";

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !body?.status) {
    throw new Error(`Paystack ${path} failed: ${body?.message ?? res.statusText}`);
  }
  return body.data as T;
}

export const paystack: PaymentProvider = {
  id: "paystack",

  async initialize({ reference, amount, email, callbackUrl, metadata }) {
    const data = await call<{ authorization_url: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({ reference, amount, email, currency: "NGN", callback_url: callbackUrl, metadata }),
    });
    return { redirectUrl: data.authorization_url };
  },

  async verify(reference): Promise<VerifyResult> {
    const data = await call<{ status: string; amount: number; currency: string }>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    const status = data.status === "success" ? "success" : data.status === "failed" ? "failed" : "pending";
    return { status, amount: data.amount, raw: data };
  },

  async refund(reference, amount) {
    const data = await call<{ id: number; status: string }>("/refund", {
      method: "POST",
      body: JSON.stringify({ transaction: reference, amount }),
    });
    return { providerRef: String(data.id), status: data.status === "processed" ? "processed" : "pending" };
  },

  parseWebhook(rawBody, headers): WebhookEvent | null {
    const signature = headers.get("x-paystack-signature");
    if (!signature) return null;
    const expected = createHmac("sha512", secretKey()).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    let payload: { event?: string; data?: Record<string, unknown> };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const event = payload.event ?? "";
    const data = payload.data ?? {};
    const isRefund = event.startsWith("refund.");
    const reference = String(isRefund ? (data.transaction_reference ?? "") : (data.reference ?? ""));
    const typeMap: Record<string, WebhookEvent["type"]> = {
      "charge.success": "charge.success",
      "charge.failed": "charge.failed",
      "refund.processed": "refund.processed",
      "refund.failed": "refund.failed",
    };
    return {
      eventKey: `paystack:${event}:${String(data.id ?? reference)}`,
      type: typeMap[event] ?? "other",
      reference,
      amount: typeof data.amount === "number" ? data.amount : undefined,
      raw: payload,
    };
  },
};
