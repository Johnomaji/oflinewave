import { trackServer, visitorHash } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/dal";
import { defer } from "@/lib/defer";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { CheckoutError, createOrder } from "@/lib/services/checkout";
import { appUrl } from "@/lib/utils";
import { checkoutSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const limit = rateLimit(`checkout:${await clientIp()}`, 10, 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: "Too many checkout attempts. Breathe, then try again in a minute." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Check your details." }, { status: 400 });
  }

  const user = await getCurrentUser();
  try {
    const result = await createOrder({
      ...parsed.data,
      promoCode: parsed.data.promoCode || undefined,
      userId: user?.id,
      userEmail: user?.email,
    });
    const visitor = await visitorHash();
    defer(() => trackServer("order_created", { orderId: result.orderId, visitor }));
    const redirectUrl =
      result.kind === "redirect" ? result.url : appUrl(`/orders/${result.orderId}?t=${result.accessToken}`);
    return Response.json({ redirectUrl });
  } catch (error) {
    if (error instanceof CheckoutError) return Response.json({ error: error.message }, { status: 409 });
    console.error("[checkout] failed", error);
    return Response.json({ error: "Something broke on our side. Try again in a moment." }, { status: 500 });
  }
}
