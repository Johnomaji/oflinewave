import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/site/content-page";

export const metadata: Metadata = { title: "Terms", description: "The rules of the night." };

export default function TermsPage() {
  return (
    <ContentPage eyebrow="Terms" title="The fine print." intro="Short version: buy legit, show up, be good to each other." updated="November 2026">
      <h2>Tickets</h2>
      <ul>
        <li>A ticket admits the number of people shown on it, once. The first scan wins.</li>
        <li>Buy only from Oflinewave. Tickets from resellers may be fake, and we can&apos;t help if they are.</li>
        <li>We may cancel tickets bought fraudulently or resold for profit.</li>
      </ul>
      <h2>Entry</h2>
      <ul>
        <li>Age limits are on each event page. Bring valid ID; no ID, no entry, no refund.</li>
        <li>Security may search bags and refuse entry to anyone unsafe or intoxicated.</li>
        <li>Lineups, set times and venues can change. We&apos;ll tell you if anything major moves.</li>
      </ul>
      <h2>At the event</h2>
      <ul>
        <li>Respect people, staff and the venue. Harassment of any kind gets you removed.</li>
        <li>We may photograph or film the crowd for recaps. Tell a staff member if you&apos;d rather not be in them.</li>
      </ul>
      <h2>Payments and refunds</h2>
      <p>
        Payments are processed by Paystack. Service fees are shown before you pay. Refunds follow our <Link href="/refunds">refund policy</Link>.
      </p>
      <h2>Liability</h2>
      <p>You attend at your own risk. To the extent the law allows, our liability is limited to the price you paid for your ticket.</p>
      <h2>Contact</h2>
      <p>
        Questions? <Link href="/contact">Get in touch</Link>.
      </p>
    </ContentPage>
  );
}
