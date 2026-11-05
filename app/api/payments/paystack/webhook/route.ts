import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { paystack } from "@/lib/payments/paystack";
import { handlePaymentFailure, handlePaymentSuccess } from "@/lib/services/fulfillment";

/**
 * Paystack webhook. Signature-verified, and idempotent: each event is recorded
 * under a unique key before processing, so redeliveries are acknowledged
 * without being applied twice. (Fulfilment is independently idempotent too.)
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const event = paystack.parseWebhook(rawBody, request.headers);
  if (!event) return new Response("Invalid signature", { status: 401 });

  try {
    await db.webhookEvent.create({
      data: { provider: "paystack", eventKey: event.eventKey, payload: event.raw as Prisma.InputJsonValue },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ ok: true, duplicate: true });
    }
    throw error;
  }

  try {
    switch (event.type) {
      case "charge.success":
        await handlePaymentSuccess(event.reference, event.amount ?? 0, event.raw);
        break;
      case "charge.failed":
        await handlePaymentFailure(event.reference, event.raw);
        break;
      case "refund.processed":
      case "refund.failed": {
        const refundId = String((event.raw as { data?: { id?: unknown } }).data?.id ?? "");
        if (refundId) {
          await db.refund.updateMany({
            where: { providerRef: refundId },
            data: { status: event.type === "refund.processed" ? "PROCESSED" : "FAILED" },
          });
        }
        break;
      }
    }
  } catch (error) {
    // Let Paystack retry: forget we saw it.
    await db.webhookEvent.delete({ where: { eventKey: event.eventKey } }).catch(() => {});
    console.error("[webhook] processing failed", event.eventKey, error);
    return new Response("Processing failed", { status: 500 });
  }

  return Response.json({ ok: true });
}
