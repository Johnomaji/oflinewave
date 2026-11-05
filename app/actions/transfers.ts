"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthorizedTicket } from "@/lib/data/tickets";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { TransferError, renameTicket, transferTicket } from "@/lib/services/transfers";

export type TicketActionState = { ok?: string; error?: string };

const base = z.object({
  ticketId: z.string().min(1).max(40),
  ticketToken: z.string().max(100).optional(),
  orderToken: z.string().max(100).optional(),
});

async function guard(formData: FormData) {
  if (!rateLimit(`ticket-change:${await clientIp()}`, 10, 10 * 60_000).ok) {
    return { error: "Too many changes. Try again in a few minutes." } as const;
  }
  const parsed = base.safeParse({
    ticketId: formData.get("ticketId"),
    ticketToken: formData.get("ticketToken") || undefined,
    orderToken: formData.get("orderToken") || undefined,
  });
  if (!parsed.success) return { error: "Something's off with that ticket." } as const;
  const ticket = await getAuthorizedTicket(parsed.data.ticketId, parsed.data);
  if (!ticket) return { error: "You can't change this ticket." } as const;
  return { ticket } as const;
}

export async function transferTicketAction(_prev: TicketActionState, formData: FormData): Promise<TicketActionState> {
  const checked = await guard(formData);
  if ("error" in checked) return { error: checked.error };
  const to = z
    .object({ name: z.string().trim().min(2, "Enter their name").max(100), email: z.email("Enter a valid email").max(200) })
    .safeParse({ name: formData.get("name"), email: formData.get("email") });
  if (!to.success) return { error: to.error.issues[0]?.message };

  try {
    await transferTicket(checked.ticket.id, to.data, { kind: "holder" });
  } catch (error) {
    if (error instanceof TransferError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/orders/${checked.ticket.orderId}`);
  return { ok: `Sent to ${to.data.email}. Your old QR no longer works.` };
}

export async function renameTicketAction(_prev: TicketActionState, formData: FormData): Promise<TicketActionState> {
  const checked = await guard(formData);
  if ("error" in checked) return { error: checked.error };
  const name = z.string().trim().min(2, "Enter a name").max(100).safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0]?.message };

  try {
    await renameTicket(checked.ticket.id, name.data, { kind: "holder" });
  } catch (error) {
    if (error instanceof TransferError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/orders/${checked.ticket.orderId}`);
  revalidatePath(`/tickets/${checked.ticket.id}`);
  return { ok: "Name updated." };
}
