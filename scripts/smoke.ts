/**
 * Service-level smoke test for checkout, add-ons, Wave Club, transfers,
 * check-in, waitlist and analytics. Runs against your DEV database and leaves
 * test orders behind: run `npm run db:seed` afterwards for a clean slate.
 *
 *   npm run test:smoke
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { createOrder, CheckoutError } from "@/lib/services/checkout";
import { handlePaymentSuccess } from "@/lib/services/fulfillment";
import { transferTicket, renameTicket, TransferError } from "@/lib/services/transfers";
import { checkIn, redeemAddOn } from "@/lib/services/checkin";
import { refundTicket } from "@/lib/services/refunds";
import { notifyWaitlist } from "@/lib/services/waitlist";
import { getAccount } from "@/lib/services/loyalty";
import { getFunnel } from "@/lib/analytics";

const ok = (label: string, cond: boolean, extra = "") => console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function expectError(label: string, fn: () => Promise<unknown>, match: RegExp) {
  try {
    await fn();
    ok(label, false, "no error");
  } catch (e) {
    ok(label, (e instanceof CheckoutError || e instanceof TransferError) && match.test((e as Error).message), (e as Error).message);
  }
}

async function main() {
  const ev = await db.event.findUniqueOrThrow({ where: { slug: "signal-lost" }, include: { tiers: true, addOns: true } });
  const regular = ev.tiers.find((t) => t.name === "Regular")!;
  const members = ev.tiers.find((t) => t.visibility === "MEMBERS")!;
  const parking = ev.addOns.find((a) => a.name === "Parking pass")!;
  const admin = process.env.SUPER_ADMIN_EMAIL!.toLowerCase();
  const buyer = `e2e${Date.now()}@example.com`;

  // 1. Checkout with add-ons + referral code
  const parkingBefore = parking.sold;
  const r = await createOrder({
    eventId: ev.id,
    items: [{ tierId: regular.id, quantity: 2 }],
    addOns: [{ addOnId: parking.id, quantity: 1 }],
    buyer: { name: "Eddie Tester", email: buyer },
    promoCode: "ADMIN-WAVE",
  });
  const order = await db.order.findUniqueOrThrow({ where: { id: r.orderId }, include: { addOns: true, payments: true } });
  // 2 × 12,000 = 24,000, −10% on tickets = 21,600, + parking 5,000 = 26,600; fee 5% + ₦100×2
  const expected = 2_660_000 + Math.round(2_660_000 * 0.05) + 20_000;
  ok("checkout total includes add-on, promo on tickets only", order.total === expected, `${order.total} vs ${expected}`);
  ok("order add-on line saved", order.addOns.length === 1 && order.addOns[0].quantity === 1);

  const adminBefore = (await getAccount(admin))?.points ?? 0;
  await handlePaymentSuccess(order.payments[0].reference, order.total, { e2e: true });
  await wait(2500);
  const parkingAfter = (await db.addOn.findUniqueOrThrow({ where: { id: parking.id } })).sold;
  ok("add-on stock incremented on payment", parkingAfter === parkingBefore + 1);
  const buyerAcct = await getAccount(buyer);
  ok("buyer earned points", buyerAcct?.points === Math.floor(order.total / 10_000), `${buyerAcct?.points}`);
  const adminAfter = (await getAccount(admin))?.points ?? 0;
  ok("referrer earned 500", adminAfter - adminBefore === 500, `${adminAfter - adminBefore}`);
  await handlePaymentSuccess(order.payments[0].reference, order.total, { e2e: "dup" });
  await wait(800);
  ok("points idempotent on duplicate webhook", (await getAccount(buyer))?.points === buyerAcct?.points);

  // 2. Guards
  await expectError(
    "self-referral blocked",
    () => createOrder({ eventId: ev.id, items: [{ tierId: regular.id, quantity: 1 }], buyer: { name: "Admin", email: admin }, promoCode: "ADMIN-WAVE" }),
    /own referral/,
  );
  await expectError(
    "members tier blocked for guests",
    () => createOrder({ eventId: ev.id, items: [{ tierId: members.id, quantity: 1 }], buyer: { name: "Guest", email: "guest@example.com" } }),
    /Wave Club/,
  );
  const m = await createOrder({ eventId: ev.id, items: [{ tierId: members.id, quantity: 1 }], buyer: { name: "Admin", email: admin }, userEmail: admin });
  ok("members tier allowed for member", Boolean(m.orderId));

  // 3. Transfer: new QR, old QR dead, recipient can scan
  const tickets = await db.ticket.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
  const t = tickets[0];
  const oldToken = t.qrToken;
  const { qrToken: newToken } = await transferTicket(t.id, { name: "Friend Person", email: "friend@example.com" }, { kind: "holder" });
  ok("transfer re-issues QR", newToken !== oldToken && newToken.split(".").length === 4);
  const door = await db.user.findUniqueOrThrow({ where: { email: "door@oflinewave.test" } });
  const oldScan = await checkIn({ eventId: ev.id, staffId: door.id, token: oldToken });
  ok("old QR rejected after transfer", oldScan.state === "invalid", oldScan.state === "invalid" ? oldScan.reason : oldScan.state);
  await expectError("can't transfer to current holder", () => transferTicket(t.id, { name: "x", email: "friend@example.com" }, { kind: "holder" }), /already the ticket holder/);
  await renameTicket(t.id, "Friend P. Renamed", { kind: "holder" });
  const renamed = await db.ticket.findUniqueOrThrow({ where: { id: t.id } });
  ok("rename keeps QR, changes name", renamed.qrToken === newToken && renamed.holderName === "Friend P. Renamed");
  const newScan = await checkIn({ eventId: ev.id, staffId: door.id, token: newToken });
  ok("new QR scans valid + shows add-ons", newScan.state === "valid" && newScan.addOns.length === 1);
  await expectError("can't transfer a scanned ticket", () => transferTicket(t.id, { name: "y", email: "y@example.com" }, { kind: "holder" }), /scanned/);
  ok("transfer trail recorded", (await db.ticketTransfer.count({ where: { ticketId: t.id } })) === 2);

  // 4. Add-on redemption can't exceed quantity
  const line = order.addOns[0];
  const r1 = await redeemAddOn(line.id, ev.id);
  const r2 = await redeemAddOn(line.id, ev.id);
  ok("add-on hand-over once only", r1.ok && !r2.ok);

  // 5. Transfer window
  await db.event.update({ where: { id: ev.id }, data: { transferCutoffHours: 24 * 365 } });
  await expectError("transfer window enforced", () => transferTicket(tickets[1].id, { name: "z", email: "z@example.com" }, { kind: "holder" }), /closed/);
  const adminT = await transferTicket(tickets[1].id, { name: "Zed", email: "z@example.com" }, { kind: "admin", userId: door.id }).then(
    () => true,
    () => false,
  );
  ok("admin can transfer outside window", adminT);
  await db.event.update({ where: { id: ev.id }, data: { transferCutoffHours: 24 } });

  // 6. Waitlist: each person emailed once
  const slow = await db.event.findUniqueOrThrow({ where: { slug: "sunday-slowdown" } });
  await db.waitlistEntry.createMany({ data: [{ eventId: slow.id, email: "wl1@example.com" }, { eventId: slow.id, email: "wl2@example.com" }] });
  const first = await notifyWaitlist(slow.id);
  const second = await notifyWaitlist(slow.id);
  ok("waitlist emails each person once", first.sent === 2 && second.sent === 0, `${first.sent}/${second.sent}`);
  const ticketToRefund = await db.ticket.findFirstOrThrow({ where: { orderId: order.id, status: "VALID" } });
  await refundTicket(ticketToRefund.id, door.id, "e2e");
  ok("ticket refund ok", (await db.ticket.findUniqueOrThrow({ where: { id: ticketToRefund.id } })).status === "REFUNDED");

  // 7. Funnel
  const funnel = await getFunnel({ eventId: ev.id });
  ok("funnel has data", funnel.steps[0].count > funnel.steps[3].count && funnel.steps[3].count > 0, funnel.steps.map((s) => s.count).join(" → "));
  await wait(2500);
}

main()
  .catch((e) => {
    console.error("CRASH", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
