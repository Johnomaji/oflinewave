import { z } from "zod";
import { scanGuard } from "@/lib/scan-auth";
import { checkIn, checkInStats } from "@/lib/services/checkin";

const schema = z
  .object({
    eventId: z.string().min(1).max(40),
    token: z.string().max(200).optional(),
    ticketId: z.string().max(40).optional(),
  })
  .refine((v) => v.token || v.ticketId, "token or ticketId required");

export async function POST(request: Request) {
  const user = await scanGuard();
  if (user instanceof Response) return user;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  const result = await checkIn({ ...parsed.data, staffId: user.id });
  const stats = await checkInStats(parsed.data.eventId);
  return Response.json({ result, stats });
}
