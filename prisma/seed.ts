/**
 * Dev seed: 3 upcoming events (paid tiers, a code-only tier, a free RSVP),
 * 2 past events for the recap strip, promo codes, staff, and realistic sales
 * history so the dashboard, "Only N left" badges and the scanner have data.
 *
 *   npm run db:seed        (wipes and reseeds; refuses to run in production)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../lib/generated/prisma/client";
import { newId } from "../lib/ids";
import { hashPassword } from "../lib/password";
import { computePricing } from "../lib/pricing";
import { createAccessToken, createOrderReference, createQrToken, createTicketCode } from "../lib/tickets/token";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");
// The seed wipes everything first. Running it from a laptop against the live database would
// pass the NODE_ENV check, so also refuse any database that isn't on this machine.
const dbHost = new URL(process.env.DATABASE_URL ?? "postgresql://localhost").hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(dbHost) && process.env.SEED_ALLOW_REMOTE !== "1") {
  throw new Error(`Refusing to seed ${dbHost}: the seed deletes all data. Set SEED_ALLOW_REMOTE=1 for a throwaway staging database.`);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DAY = 86_400_000;
const DEV_STAFF_PASSWORD = "wave-dev-password";
const HOUR = 3_600_000;

/** A date N days from today at a given Lagos (UTC+1) hour. */
function lagos(daysFromNow: number, hour: number) {
  const d = new Date(Date.now() + daysFromNow * DAY);
  d.setUTCHours(hour - 1, 0, 0, 0);
  return d;
}

// Deterministic pseudo-random so reseeding gives the same dashboard.
let seed = 42;
function rand() {
  seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
  return seed / 2 ** 31;
}
const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];

const FIRST = ["Tolu", "Ada", "Kemi", "Chidi", "Bayo", "Zainab", "Ife", "Emeka", "Funmi", "Seyi", "Ngozi", "Dami", "Tobi", "Amaka", "Kunle", "Halima", "Uche", "Bisi", "Femi", "Ireti"];
const LAST = ["Adeyemi", "Okafor", "Bello", "Eze", "Balogun", "Nwosu", "Ogunleye", "Musa", "Okoro", "Lawal", "Obi", "Afolabi"];

async function reset() {
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.analyticsEvent.deleteMany(),
    db.pointsEntry.deleteMany(),
    db.loyaltyAccount.deleteMany(),
    db.ticketTransfer.deleteMany(),
    db.orderAddOn.deleteMany(),
    db.webhookEvent.deleteMany(),
    db.refund.deleteMany(),
    db.payment.deleteMany(),
    db.ticket.deleteMany(),
    db.orderItem.deleteMany(),
    db.order.deleteMany(),
    db.promoCode.deleteMany(),
    db.waitlistEntry.deleteMany(),
    db.eventMedia.deleteMany(),
    db.ticketTier.deleteMany(),
    db.addOn.deleteMany(),
    db.event.deleteMany(),
    db.venue.deleteMany(),
    db.staffMember.deleteMany(),
    db.newsletterSubscriber.deleteMany(),
  ]);
}

type TierSeed = Omit<Prisma.TicketTierCreateWithoutEventInput, "sold"> & { sell: number };

function withoutSell({ sell, ...tier }: TierSeed) {
  void sell;
  return tier;
}

async function createEvent(data: Omit<Prisma.EventCreateInput, "tiers">, tiers: TierSeed[]) {
  const event = await db.event.create({
    data: {
      ...data,
      tiers: { create: tiers.map((t, i) => ({ ...withoutSell(t), sortOrder: i })) },
    },
    include: { tiers: { orderBy: { sortOrder: "asc" } } },
  });
  return { event, sell: tiers.map((t) => t.sell) };
}

/** Generates paid orders until each tier hits its `sell` target. */
async function simulateSales(
  created: Awaited<ReturnType<typeof createEvent>>,
  fee: { feePercentBps: number; feeFlat: number },
  opts: { checkInShare?: number; staffId?: string } = {},
) {
  const { event, sell } = created;
  const feeMode = event.feeMode ?? "PASS_TO_BUYER";
  const daysBack = Math.max(Math.round((event.startsAt.getTime() - Date.now()) / DAY), 0);

  for (const [index, tier] of event.tiers.entries()) {
    let remaining = sell[index];
    while (remaining > 0) {
      const quantity = Math.min(remaining, tier.admits > 1 ? 1 : 1 + Math.floor(rand() * 4), tier.maxPerOrder);
      remaining -= quantity;

      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const email = `${name.toLowerCase().replace(" ", ".")}${Math.floor(rand() * 90 + 10)}@example.com`;
      const paidAt =
        daysBack > 0
          ? new Date(Date.now() - Math.floor(rand() * 21 * DAY) - Math.floor(rand() * 20 * HOUR))
          : new Date(event.startsAt.getTime() - Math.floor(rand() * 21 * DAY));
      const pricing = computePricing([{ tierId: tier.id, unitPrice: tier.price, quantity }], { ...fee, feeMode });

      const orderId = newId("o");
      const reference = createOrderReference();
      const tickets = Array.from({ length: quantity }, (_, i) => {
        const id = newId();
        const checkedIn = opts.checkInShare !== undefined && rand() < opts.checkInShare;
        return {
          id,
          code: createTicketCode(),
          qrToken: createQrToken(id),
          eventId: event.id,
          tierId: tier.id,
          holderName: i === 0 ? name : `${pick(FIRST)} ${pick(LAST)}`,
          holderEmail: email,
          status: checkedIn ? ("CHECKED_IN" as const) : ("VALID" as const),
          checkedInAt: checkedIn ? new Date(event.startsAt.getTime() + Math.floor(rand() * 3 * HOUR)) : null,
          checkedInById: checkedIn ? (opts.staffId ?? null) : null,
          createdAt: paidAt,
        };
      });

      await db.order.create({
        data: {
          id: orderId,
          reference,
          eventId: event.id,
          buyerName: name,
          buyerEmail: email,
          buyerPhone: `+23480${Math.floor(10_000_000 + rand() * 89_999_999)}`,
          status: "PAID",
          subtotal: pricing.subtotal,
          fees: pricing.fees,
          total: pricing.total,
          feeMode,
          accessToken: createAccessToken(),
          paidAt,
          createdAt: paidAt,
          items: { create: [{ tierId: tier.id, quantity, unitPrice: tier.price }] },
          tickets: { create: tickets },
          payments:
            pricing.total > 0
              ? { create: [{ provider: "paystack", reference: `${reference}-1`, status: "SUCCESS", amount: pricing.total, createdAt: paidAt }] }
              : undefined,
        },
      });
    }
    await db.ticketTier.update({ where: { id: tier.id }, data: { sold: sell[index] } });
  }
}

async function main() {
  await reset();

  const settings = await db.setting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, instagramUrl: "https://instagram.com/oflinewave", tiktokUrl: "https://tiktok.com/@oflinewave" },
  });
  const fee = { feePercentBps: settings.feePercentBps, feeFlat: settings.feeFlat };

  // Staff
  // The first SUPER_ADMIN_EMAIL is seeded; any others are promoted when they sign in.
  // Local-only staff password (the seed refuses non-local databases).
  const devPasswordHash = await hashPassword(DEV_STAFF_PASSWORD);
  const adminEmail = (process.env.SUPER_ADMIN_EMAIL?.split(",")[0]?.trim() || "admin@oflinewave.test").toLowerCase();
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { role: "SUPER_ADMIN", passwordHash: devPasswordHash },
    create: { email: adminEmail, name: "Oflinewave Admin", role: "SUPER_ADMIN", passwordHash: devPasswordHash },
  });
  const door = await db.user.upsert({
    where: { email: "door@oflinewave.test" },
    update: { role: "DOOR_STAFF", passwordHash: devPasswordHash },
    create: { email: "door@oflinewave.test", name: "Door Team", role: "DOOR_STAFF", passwordHash: devPasswordHash },
  });
  await db.staffMember.createMany({
    data: [
      { email: adminEmail, role: "SUPER_ADMIN", acceptedAt: new Date() },
      { email: door.email, role: "DOOR_STAFF", invitedById: admin.id, acceptedAt: new Date() },
    ],
  });

  // Venues (fictional)
  const warehouse = await db.venue.create({
    data: {
      name: "Warehouse 9",
      address: "9 Industrial Avenue, Ebute Metta",
      city: "Lagos",
      mapUrl: "https://maps.google.com/?q=Ebute+Metta+Lagos",
    },
  });
  const garden = await db.venue.create({
    data: {
      name: "Palmside Garden",
      address: "14 Admiralty Way, Lekki Phase 1",
      city: "Lagos",
      mapUrl: "https://maps.google.com/?q=Admiralty+Way+Lekki",
    },
  });
  const hall = await db.venue.create({
    data: {
      name: "The Assembly Hall",
      address: "3 Ozumba Mbadiwe Avenue, Victoria Island",
      city: "Lagos",
      mapUrl: "https://maps.google.com/?q=Ozumba+Mbadiwe+Victoria+Island",
    },
  });
  const chancery = await db.venue.create({
    data: { name: "The Chancery Hotel", address: "Owo, Ondo State", city: "Owo" },
  });
  const rooftop = await db.venue.create({
    data: { name: "Skyline Deck", address: "22 Adeola Odeku Street, Victoria Island", city: "Lagos" },
  });

  const standardFaqs = [
    { q: "Can I bring my phone?", a: "Yes, but it lives in your pocket. We'll have phone pouches at the door for anyone who wants to fully unplug." },
    { q: "Is there re-entry?", a: "No re-entry after midnight. Step out, you're out." },
    { q: "What's the refund policy?", a: "Tickets are non-refundable unless the event is cancelled or moved. You can transfer your ticket to a friend up to 24 hours before doors." },
  ];

  // 1. Featured party (the crew's real poster)
  const signalLost = await createEvent(
    {
      slug: "shut-up-dance-2",
      title: "Shut Up & Dance 2.0",
      tagline: "One last dance. Oflinewave in collaboration with Ifychops.",
      description:
        "Shut Up & Dance is back for one last dance. Oflinewave and Ifychops take over The Chancery Hotel, Owo, from 5pm till late.\n\nSound by DJ Kay Unique, with Hypeman Biggie, Heniolastickz and live sax. Phones down, volume up.",
      category: "PARTY",
      status: "PUBLISHED",
      featured: true,
      startsAt: lagos(24, 17),
      endsAt: lagos(24, 23),
      posterUrl: "/posters/shut-up-dance-2.jpg",
      lineup: ["DJ Kay Unique", "Hypeman Biggie", "Heniolastickz", "Sax"],
      ageLimit: 18,
      dressCode: "Come colourful. Come ready to dance.",
      refundPolicy: "Non-refundable. Transferable until 24 hours before doors.",
      faqs: standardFaqs,
      venue: { connect: { id: chancery.id } },
      media: { create: [{ url: "/photos/floor-3.jpg", alt: "Two guests wearing Oflinewave lanyards", sortOrder: 0 }] },
    },
    [
      { name: "Early Bird", description: "For the ones who move first.", price: 800_000, quantity: 150, sell: 150, salesEnd: lagos(-3, 23) },
      { name: "Regular", description: "General admission.", price: 1_200_000, quantity: 300, sell: 128 },
      { name: "VIP", description: "Fast-lane entry, raised deck, one welcome drink.", price: 3_000_000, quantity: 60, sell: 48 },
      { name: "Table for 6", description: "Reserved table, bottle of your choice, admits six.", price: 25_000_000, quantity: 10, admits: 6, maxPerOrder: 2, sell: 4 },
      { name: "Friends of the Wave", description: "Code-only. You know who you are.", price: 600_000, quantity: 40, visibility: "HIDDEN", sell: 0 },
      { name: "Wave Club Early Entry", description: "Members only: in before the queue, first drink on us.", price: 700_000, quantity: 50, visibility: "MEMBERS", sell: 11 },
    ],
  );
  await simulateSales(signalLost, fee);

  // 2. Day party with group bundle
  const slowdown = await createEvent(
    {
      slug: "sunday-slowdown",
      title: "Sunday Slowdown",
      tagline: "Brunch, sunshine and a sunset set. Sundays, done properly.",
      description:
        "Long tables, bottomless zobo mimosas and a soundtrack that builds from soft-life afrobeats to a full sunset dance-off.\n\nBring your people. Leave your notifications.",
      category: "DAY_PARTY",
      status: "PUBLISHED",
      startsAt: lagos(39, 13),
      endsAt: lagos(39, 21),
      posterUrl: "/posters/sunday-slowdown.svg",
      lineup: ["Ayo Sundays", "The Zobo Collective"],
      ageLimit: 18,
      dressCode: "Linen, colour, sunglasses.",
      refundPolicy: "Non-refundable. Transferable until 24 hours before doors.",
      faqs: [{ q: "Is food included?", a: "Brunch Pass includes a plated brunch. General Entry gets access to food vendors." }, ...standardFaqs.slice(1)],
      collectAttendeeNames: true,
      venue: { connect: { id: garden.id } },
    },
    [
      { name: "General Entry", description: "Entry plus access to food vendors.", price: 700_000, quantity: 250, sell: 61 },
      { name: "Brunch Pass", description: "Entry, plated brunch and two mimosas.", price: 1_500_000, quantity: 120, sell: 37 },
      { name: "Squad of 4", description: "Four brunch passes, one reserved table.", price: 5_400_000, quantity: 20, admits: 4, maxPerOrder: 2, sell: 6 },
    ],
  );
  await simulateSales(slowdown, fee);

  // 3. Live show with free RSVP; organizer absorbs fees
  const waveLive = await createEvent(
    {
      slug: "wave-live-lagos-sessions",
      title: "Wave Live: Lagos Sessions",
      tagline: "A live band, a packed room and zero screens between you and the stage.",
      description:
        "Our first live-music night. A ten-piece band runs through highlife, alté and afro-soul reworks, with surprise guests on the mic.\n\nRSVP is free but capacity is tight. Front Row gets you right up against the stage.",
      category: "CONCERT",
      status: "PUBLISHED",
      startsAt: lagos(44, 19),
      endsAt: lagos(44, 23),
      posterUrl: "/posters/wave-live.svg",
      lineup: ["The Oflinewave Band", "Special guests"],
      dressCode: "Come as you are.",
      refundPolicy: "Free RSVPs can be cancelled any time. Front Row is non-refundable.",
      faqs: standardFaqs,
      feeMode: "ABSORB",
      venue: { connect: { id: hall.id } },
    },
    [
      { name: "Free RSVP", description: "Standing room. First come, first in.", price: 0, quantity: 200, maxPerOrder: 2, sell: 141 },
      { name: "Front Row", description: "Reserved space right at the stage.", price: 1_000_000, quantity: 40, maxPerOrder: 4, sell: 9 },
    ],
  );
  await simulateSales(waveLive, fee);

  // Past events for the recap strip (with check-ins for the reports)
  const blackout = await createEvent(
    {
      slug: "blackout-vol-1",
      title: "Blackout Vol. 1",
      tagline: "No phones. No lights. Just sound.",
      description: "The one that started it. 400 people, zero screens, one very sweaty warehouse.",
      category: "PARTY",
      status: "PUBLISHED",
      startsAt: lagos(-52, 22),
      endsAt: lagos(-51, 4),
      posterUrl: "/photos/floor-3.jpg",
      lineup: ["DJ Kaye", "Femz"],
      media: {
        create: [
          { url: "/photos/floor-1.jpg", alt: "Guest in a butterfly top wearing an Oflinewave lanyard", sortOrder: 0 },
          { url: "/photos/floor-2.jpg", alt: "Guest wearing an Oflinewave official pass", sortOrder: 1 },
          { url: "/photos/floor-3.jpg", alt: "Two guests wearing Oflinewave lanyards", sortOrder: 2 },
        ],
      },
      ageLimit: 18,
      venue: { connect: { id: warehouse.id } },
    },
    [{ name: "General", price: 1_000_000, quantity: 400, sell: 400 }],
  );
  await simulateSales(blackout, fee, { checkInShare: 0.93, staffId: door.id });

  const rooftopStatic = await createEvent(
    {
      slug: "rooftop-static",
      title: "Rooftop Static",
      tagline: "Golden hour sessions above the city.",
      description: "Sunset, skyline and a set that ran an hour over. Thank you, Lagos.",
      category: "DAY_PARTY",
      status: "PUBLISHED",
      startsAt: lagos(-26, 16),
      endsAt: lagos(-26, 22),
      posterUrl: "/posters/rooftop-static.svg",
      lineup: ["Ayo Sundays", "Toni Wavy"],
      venue: { connect: { id: rooftop.id } },
    },
    [{ name: "General", price: 1_200_000, quantity: 180, sell: 172 }],
  );
  await simulateSales(rooftopStatic, fee, { checkInShare: 0.9, staffId: door.id });

  // Promo codes
  const friendsTier = signalLost.event.tiers.find((t) => t.name === "Friends of the Wave")!;
  await db.promoCode.createMany({
    data: [
      { code: "WAVE10", type: "PERCENT", value: 10, maxUses: 100, expiresAt: lagos(60, 23) },
      { code: "FRIENDS", type: "PERCENT", value: 0, eventId: signalLost.event.id, tierIds: [friendsTier.id], maxUses: 40 },
      { code: "SUNDAY2K", type: "FIXED", value: 200_000, eventId: slowdown.event.id, maxUses: 50 },
    ],
  });

  // Add-ons
  await db.addOn.createMany({
    data: [
      { eventId: signalLost.event.id, name: "Parking pass", description: "One car, collect at the gate.", price: 500_000, quantity: 80, maxPerOrder: 2, sortOrder: 0 },
      { eventId: signalLost.event.id, name: "Drinks bundle", description: "Four drink tokens, skip the bar queue.", price: 1_200_000, quantity: 200, maxPerOrder: 6, sortOrder: 1 },
      { eventId: slowdown.event.id, name: "Mimosa jug", description: "Bottomless zobo mimosa jug for your table.", price: 1_800_000, quantity: 40, maxPerOrder: 3, sortOrder: 0 },
    ],
  });

  // Wave Club: backfill points from every paid order, like fulfilment would.
  const paidOrders = await db.order.findMany({ where: { status: "PAID" }, select: { id: true, buyerEmail: true, total: true, paidAt: true } });
  const byEmail = new Map<string, { id: string; total: number; paidAt: Date | null }[]>();
  for (const o of paidOrders) byEmail.set(o.buyerEmail, [...(byEmail.get(o.buyerEmail) ?? []), o]);
  for (const [email, list] of byEmail) {
    const entries = list.map((o) => ({ orderId: o.id, delta: Math.max(Math.floor(o.total / 10_000), 10), reason: "order", createdAt: o.paidAt ?? new Date() }));
    const sum = entries.reduce((n, e) => n + e.delta, 0);
    await db.loyaltyAccount.create({ data: { email, points: sum, lifetimePoints: sum, entries: { create: entries } } });
  }

  // Funnel analytics for the last 30 days, roughly in line with real sales.
  const analytics: { type: string; eventId: string; visitorHash: string; referrer: string | null; createdAt: Date }[] = [];
  const sources = ["instagram.com", "t.co", "whatsapp.com", "google.com", null, null];
  for (const e of [signalLost.event, slowdown.event, waveLive.event]) {
    const recent = await db.order.count({ where: { eventId: e.id, status: "PAID", paidAt: { gte: new Date(Date.now() - 30 * DAY) } } });
    const views = recent * 7 + 40;
    for (let i = 0; i < views; i++) {
      const createdAt = new Date(Date.now() - Math.floor(rand() * 30 * DAY));
      const visitorHash = `seed-${e.id}-${i}`;
      const referrer = pick(sources);
      analytics.push({ type: "event_view", eventId: e.id, visitorHash, referrer, createdAt });
      if (rand() < 0.3) analytics.push({ type: "checkout_view", eventId: e.id, visitorHash, referrer: null, createdAt });
    }
    for (let i = 0; i < Math.round(recent * 1.25); i++) {
      analytics.push({ type: "order_created", eventId: e.id, visitorHash: `seed-o-${e.id}-${i}`, referrer: null, createdAt: new Date(Date.now() - Math.floor(rand() * 30 * DAY)) });
    }
    for (let i = 0; i < recent; i++) {
      analytics.push({ type: "paid", eventId: e.id, visitorHash: `seed-p-${e.id}-${i}`, referrer: null, createdAt: new Date(Date.now() - Math.floor(rand() * 30 * DAY)) });
    }
  }
  await db.analyticsEvent.createMany({ data: analytics });

  // A known test ticket you can scan at the door
  const regular = signalLost.event.tiers.find((t) => t.name === "Regular")!;
  const testTicketId = newId();
  const testOrder = await db.order.create({
    data: {
      reference: "OW-TESTDOOR",
      eventId: signalLost.event.id,
      buyerName: "Test Raver",
      buyerEmail: adminEmail,
      status: "PAID",
      source: "COMP",
      subtotal: 0,
      total: 0,
      feeMode: "PASS_TO_BUYER",
      accessToken: "test-access-token-do-not-use-in-prod",
      paidAt: new Date(),
      items: { create: [{ tierId: regular.id, quantity: 1, unitPrice: 0 }] },
      tickets: {
        create: [
          {
            id: testTicketId,
            code: "TESTDOOR",
            qrToken: createQrToken(testTicketId),
            eventId: signalLost.event.id,
            tierId: regular.id,
            holderName: "Test Raver",
            holderEmail: adminEmail,
          },
        ],
      },
    },
  });
  await db.ticketTier.update({ where: { id: regular.id }, data: { sold: { increment: 1 } } });

  // The admin is a Wave Club member with a referral code (for testing member tiers and referrals).
  await db.loyaltyAccount.upsert({
    where: { email: adminEmail },
    update: { points: { increment: 1200 }, lifetimePoints: { increment: 1200 } },
    create: { email: adminEmail, points: 1200, lifetimePoints: 1200 },
  });
  await db.promoCode.create({ data: { code: "ADMIN-WAVE", type: "PERCENT", value: 10, referrerEmail: adminEmail } });
  await db.loyaltyAccount.update({ where: { email: adminEmail }, data: { referralCode: "ADMIN-WAVE" } });

  const [orders, tickets] = await Promise.all([db.order.count(), db.ticket.count()]);
  console.log(`Seeded 5 events, ${orders} orders, ${tickets} tickets.`);
  console.log(`Super admin: ${adminEmail}  ·  Door staff: ${door.email}  ·  Password: ${DEV_STAFF_PASSWORD}`);
  console.log(`Test ticket: /orders/${testOrder.id}?t=${testOrder.accessToken}  (code TESTDOOR)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
