/**
 * Live-safe demo seed: adds a published test event so people can try the full flow
 * (browse → buy → ticket → door scan) on a real deployment, plus the last real night as a
 * past event. Deletes nothing; each event is skipped if it already exists. Archive or delete
 * the test event in /admin when testing is done.
 *
 *   npm run db:seed-demo
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DAY = 86_400_000;
const SLUG = "oflinewave-test-night";

/** A date N days from today at a given Lagos (UTC+1) hour. */
function lagos(daysFromNow: number, hour: number) {
  const d = new Date(Date.now() + daysFromNow * DAY);
  d.setUTCHours(hour - 1, 0, 0, 0);
  return d;
}

async function main() {
  await db.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  await createTestEvent();
  await createPastEvent();
}

async function createTestEvent() {
  const existing = await db.event.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`Demo event already exists: /events/${SLUG}`);
    return;
  }

  const venue = await db.venue.create({
    data: {
      name: "Warehouse 9",
      address: "9 Industrial Avenue, Ebute Metta",
      city: "Lagos",
      mapUrl: "https://maps.google.com/?q=Ebute+Metta+Lagos",
    },
  });

  await db.event.create({
    data: {
      slug: SLUG,
      title: "Oflinewave Test Night",
      tagline: "A test event for trying tickets end to end. Not a real party (yet).",
      description:
        "This event exists so you can test the full Oflinewave flow: pick a ticket, check out, get your ticket by email, and have it scanned at the door.\n\nThe free RSVP needs no payment. The paid tier goes through Paystack, so use a test card while Paystack is in test mode.",
      category: "PARTY",
      status: "PUBLISHED",
      featured: true,
      startsAt: lagos(30, 22),
      endsAt: lagos(31, 4),
      posterUrl: "/posters/signal-lost.svg",
      lineup: ["DJ Test", "The Oflinewave Band"],
      ageLimit: 18,
      dressCode: "Come as you are.",
      refundPolicy: "Test event: nothing is refundable because nothing is real.",
      faqs: [
        { q: "Is this a real event?", a: "No. It's for testing the ticketing flow." },
        { q: "Which card do I use?", a: "While Paystack is in test mode, use Paystack's test card 4084 0840 8408 4081, any future expiry, CVV 408." },
      ],
      venue: { connect: { id: venue.id } },
      tiers: {
        create: [
          { name: "Free RSVP", description: "No payment needed. Tests the ticket and scan flow.", price: 0, quantity: 200, maxPerOrder: 2, sortOrder: 0 },
          { name: "Regular", description: "₦1,000 paid ticket. Tests Paystack checkout.", price: 100_000, quantity: 200, maxPerOrder: 4, sortOrder: 1 },
          { name: "VIP", description: "₦5,000 paid ticket.", price: 500_000, quantity: 50, maxPerOrder: 4, sortOrder: 2 },
        ],
      },
    },
  });

  console.log(`Created demo event: /events/${SLUG}`);
}

/** The real last night, for the "past events" recap. No orders: it sold off-platform. */
async function createPastEvent() {
  const slug = "shut-up-x-dance-2";
  if (await db.event.findUnique({ where: { slug } })) {
    console.log(`Past event already exists: /events/${slug}`);
    return;
  }

  const venue = await db.venue.create({ data: { name: "The Chancery Hotel", address: "Owo", city: "Owo, Ondo State" } });

  await db.event.create({
    data: {
      slug,
      title: "Shut Up x Dance 2.0",
      tagline: "One last dance. In collaboration with Ifychops.",
      description:
        "Offline Wave and Ifychops took over The Chancery Hotel in Owo for an evening of sound, sunshine and phones-down dancing.\n\nThanks to everyone who came through. See you at the next one.",
      category: "PARTY",
      status: "PUBLISHED",
      startsAt: new Date("2026-10-31T16:00:00Z"), // 5 PM Lagos
      endsAt: new Date("2026-10-31T23:00:00Z"),
      posterUrl: "/posters/shut-up-x-dance-2.jpg",
      lineup: ["DJ Kay Unique", "Hypeman Biggie", "Heniolastickz", "Sax"],
      venue: { connect: { id: venue.id } },
      media: {
        create: [
          { url: "/photos/floor-1.jpg", alt: "Guest wearing the official Offline Wave pass", sortOrder: 0 },
          { url: "/photos/floor-2.jpg", alt: "Guest wearing the official Offline Wave pass", sortOrder: 1 },
          { url: "/photos/floor-3.jpg", alt: "Two guests wearing official Offline Wave passes", sortOrder: 2 },
        ],
      },
    },
  });

  console.log(`Created past event: /events/${slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
