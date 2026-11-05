/**
 * Provider-agnostic payment interface. Paystack is the only live provider today;
 * Flutterwave or Stripe slot in by implementing this and registering in ./index.ts.
 */
export type InitializeInput = {
  /** unique per payment attempt */
  reference: string;
  /** kobo */
  amount: number;
  email: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

export type VerifyResult = {
  status: "success" | "failed" | "pending";
  /** kobo actually charged */
  amount: number;
  raw: unknown;
};

export type WebhookEvent = {
  /** unique per delivery-worthy event, used for idempotency */
  eventKey: string;
  type: "charge.success" | "charge.failed" | "refund.processed" | "refund.failed" | "other";
  reference: string;
  amount?: number;
  raw: unknown;
};

export type RefundResult = { providerRef: string; status: "pending" | "processed" };

export interface PaymentProvider {
  id: string;
  initialize(input: InitializeInput): Promise<{ redirectUrl: string }>;
  verify(reference: string): Promise<VerifyResult>;
  refund(reference: string, amount: number): Promise<RefundResult>;
  /** Verifies the signature. Returns null for forged or malformed payloads. */
  parseWebhook(rawBody: string, headers: Headers): WebhookEvent | null;
}
