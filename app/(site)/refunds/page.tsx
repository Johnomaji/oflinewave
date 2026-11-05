import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/site/content-page";

export const metadata: Metadata = { title: "Refund policy", description: "When you get your money back." };

export default function RefundsPage() {
  return (
    <ContentPage eyebrow="Refunds" title="Straight answers on refunds." updated="November 2026">
      <h2>We cancel, you get paid back</h2>
      <p>If we cancel an event, you get a full refund, including service fees, to your original payment method. No need to ask.</p>
      <h2>We move it, you choose</h2>
      <p>If the date or venue changes, your ticket rolls over automatically. Can&apos;t make the new date? Ask for a refund within 7 days of the announcement.</p>
      <h2>You can&apos;t make it</h2>
      <p>Tickets are non-refundable, but most can be transferred to a friend up to 24 hours before doors. Message us with your order reference and their details.</p>
      <p>Can&apos;t use a free RSVP? Message us and we&apos;ll release it so someone on the waitlist gets your spot.</p>
      <h2>How long it takes</h2>
      <p>Once approved, refunds usually reach you in 5 to 10 working days, depending on your bank.</p>
      <h2>Questions</h2>
      <p>
        <Link href="/contact">Get in touch</Link> with your order reference (it starts with OW-).
      </p>
    </ContentPage>
  );
}
