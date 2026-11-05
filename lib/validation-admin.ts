import { z } from "zod";

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use the date picker").optional());

export const tierInputSchema = z
  .object({
    id: z.string().max(40).optional(),
    name: z.string().trim().min(1, "Tier needs a name").max(60),
    description: z.string().trim().max(300).optional(),
    priceNaira: z.number().min(0).max(100_000_000),
    quantity: z.number().int().min(0).max(1_000_000),
    minPerOrder: z.number().int().min(1).max(100),
    maxPerOrder: z.number().int().min(1).max(100),
    admits: z.number().int().min(1).max(50),
    salesStart: optionalDate,
    salesEnd: optionalDate,
    visibility: z.enum(["PUBLIC", "HIDDEN", "MEMBERS"]),
  })
  .refine((t) => t.maxPerOrder >= t.minPerOrder, { message: "Max per order must be at least min", path: ["maxPerOrder"] });

export const addOnInputSchema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(1, "Add-on needs a name").max(60),
  description: z.string().trim().max(200).optional(),
  priceNaira: z.number().min(0).max(10_000_000),
  quantity: z.number().int().min(0).max(100_000),
  maxPerOrder: z.number().int().min(1).max(50),
  active: z.boolean(),
});

export const eventInputSchema = z.object({
  id: z.string().max(40).optional(),
  title: z.string().trim().min(2, "Give it a title").max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only"),
  tagline: z.string().trim().max(200).optional(),
  description: z.string().trim().min(1, "Describe the night").max(10_000),
  category: z.enum(["PARTY", "CONCERT", "BRUNCH", "POP_UP", "DAY_PARTY", "OTHER"]),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  listed: z.boolean(),
  featured: z.boolean(),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a start time"),
  endsAt: optionalDate,
  venueId: z.string().max(40).optional(),
  newVenue: z
    .object({
      name: z.string().trim().min(1, "Venue name").max(120),
      address: z.string().trim().min(1, "Venue address").max(200),
      city: z.string().trim().min(1, "City").max(60),
      mapUrl: z.url().max(500).optional().or(z.literal("")),
    })
    .optional(),
  posterUrl: z.string().trim().min(1, "Add a poster").max(500),
  lineup: z.array(z.string().trim().min(1).max(80)).max(30),
  ageLimit: z.number().int().min(0).max(99).nullable(),
  dressCode: z.string().trim().max(300).optional(),
  refundPolicy: z.string().trim().max(500).optional(),
  faqs: z.array(z.object({ q: z.string().trim().min(1).max(200), a: z.string().trim().min(1).max(1000) })).max(20),
  feeMode: z.enum(["DEFAULT", "PASS_TO_BUYER", "ABSORB"]),
  collectAttendeeNames: z.boolean(),
  transfersEnabled: z.boolean(),
  transferCutoffHours: z.number().int().min(0).max(24 * 30),
  addOns: z.array(addOnInputSchema).max(20),
  tiers: z.array(tierInputSchema).min(1, "Add at least one ticket tier").max(20),
});

export type EventInput = z.input<typeof eventInputSchema>;
export type TierInput = z.input<typeof tierInputSchema>;
export type AddOnInput = z.input<typeof addOnInputSchema>;

export function emptyAddOn(): AddOnInput {
  return { name: "", priceNaira: 0, quantity: 100, maxPerOrder: 10, active: true };
}

export function emptyTier(): TierInput {
  return { name: "", priceNaira: 0, quantity: 100, minPerOrder: 1, maxPerOrder: 10, admits: 1, visibility: "PUBLIC" };
}
