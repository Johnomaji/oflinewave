import "server-only";
import { mockProvider } from "./mock";
import { paystack } from "./paystack";
import type { PaymentProvider } from "./types";

const providers: Record<string, PaymentProvider> = {
  paystack,
  mock: mockProvider,
};

export function isMockPaymentsEnabled() {
  return process.env.NODE_ENV !== "production" && !process.env.PAYSTACK_SECRET_KEY;
}

/** The provider new checkouts use. */
export function getActiveProvider(): PaymentProvider {
  return isMockPaymentsEnabled() ? mockProvider : paystack;
}

/** Look up the provider that handled an existing payment. */
export function getProvider(id: string): PaymentProvider {
  const provider = providers[id];
  if (!provider || (provider === mockProvider && !isMockPaymentsEnabled())) {
    throw new Error(`Unknown payment provider: ${id}`);
  }
  return provider;
}

export type { PaymentProvider } from "./types";
