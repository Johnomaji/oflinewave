"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isMockPaymentsEnabled } from "@/lib/payments";
import { handlePaymentFailure, handlePaymentSuccess } from "@/lib/services/fulfillment";
import { appUrl } from "@/lib/utils";

export async function settleMockPayment(formData: FormData) {
  if (!isMockPaymentsEnabled()) throw new Error("Mock payments are disabled");
  const reference = String(formData.get("reference"));
  const outcome = String(formData.get("outcome"));
  const callback = String(formData.get("callback"));

  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment || payment.provider !== "mock") throw new Error("Unknown mock payment");

  if (outcome === "success") await handlePaymentSuccess(reference, payment.amount, { mock: true, reference });
  else await handlePaymentFailure(reference, { mock: true, reference, outcome });

  // Only ever bounce back into our own app.
  redirect(callback.startsWith(appUrl()) ? callback : "/");
}
