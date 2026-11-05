import "server-only";
import type { PaymentProvider } from "./types";
import { appUrl } from "@/lib/utils";

/**
 * Local-development provider. Sends the buyer to /dev/pay, which simulates
 * a successful or failed charge. Never available in production.
 */
export const mockProvider: PaymentProvider = {
  id: "mock",
  async initialize({ reference, amount, callbackUrl }) {
    const params = new URLSearchParams({ reference, amount: String(amount), callback: callbackUrl });
    return { redirectUrl: appUrl(`/dev/pay?${params}`) };
  },
  async verify() {
    // The /dev/pay page settles the order directly, so there's nothing to verify.
    return { status: "pending", amount: 0, raw: null };
  },
  async refund(reference) {
    return { providerRef: `mock-refund-${reference}`, status: "processed" };
  },
  parseWebhook() {
    return null;
  },
};
