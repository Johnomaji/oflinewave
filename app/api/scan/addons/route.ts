import { z } from "zod";
import { scanGuard } from "@/lib/scan-auth";
import { redeemAddOn } from "@/lib/services/checkin";

const schema = z.object({ eventId: z.string().min(1).max(40), orderAddOnId: z.string().min(1).max(40) });

/** Door staff mark one unit of a pre-ordered add-on as handed over. */
export async function POST(request: Request) {
  const user = await scanGuard();
  if (user instanceof Response) return user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const result = await redeemAddOn(parsed.data.orderAddOnId, parsed.data.eventId);
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
