import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .max(20)
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number");

export const checkoutSchema = z.object({
  eventId: z.string().min(1).max(40),
  items: z
    .array(
      z.object({
        tierId: z.string().min(1).max(40),
        quantity: z.number().int().min(1).max(50),
        attendeeNames: z.array(z.string().trim().max(100)).max(50).optional(),
      }),
    )
    .min(1, "Pick at least one ticket")
    .max(10),
  addOns: z
    .array(z.object({ addOnId: z.string().min(1).max(40), quantity: z.number().int().min(0).max(50) }))
    .max(20)
    .optional(),
  buyer: z.object({
    name: z.string().trim().min(2, "Enter your name").max(100),
    email: z.email("Enter a valid email").max(200),
    phone: phoneSchema.optional().or(z.literal("")),
  }),
  promoCode: z.string().trim().max(40).optional(),
});

export type CheckoutPayload = z.infer<typeof checkoutSchema>;
