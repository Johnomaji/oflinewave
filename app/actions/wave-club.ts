"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { getOrCreateReferralCode } from "@/lib/services/loyalty";

export async function createReferralCode() {
  const user = await getCurrentUser();
  if (!user) return;
  await getOrCreateReferralCode(user.email, user.name);
  revalidatePath("/tickets");
}
