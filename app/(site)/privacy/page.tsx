import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/site/content-page";

export const metadata: Metadata = { title: "Privacy", description: "What we collect and why." };

export default function PrivacyPage() {
  return (
    <ContentPage eyebrow="Privacy" title="Your data, kept tight." intro="We collect what we need to get you in the door. That's it." updated="November 2026">
      <h2>What we collect</h2>
      <ul>
        <li>Your name, email and (optionally) phone number when you buy or RSVP.</li>
        <li>Names of other ticket holders, if you add them.</li>
        <li>Order history and check-in times.</li>
      </ul>
      <p>We never see or store your card details. Paystack handles payment.</p>
      <h2>Why</h2>
      <ul>
        <li>To issue and deliver your tickets, and check you in.</li>
        <li>To send receipts and important updates about events you&apos;ve booked.</li>
        <li>To send our newsletter, only if you sign up. Unsubscribe any time.</li>
      </ul>
      <h2>Who we share with</h2>
      <p>Only the services that run the platform: Paystack (payments), our email provider (ticket delivery) and our hosting and database providers. We don&apos;t sell your data.</p>
      <h2>Your rights</h2>
      <p>
        Under the Nigeria Data Protection Act you can ask to see, correct or delete your data. <Link href="/contact">Contact us</Link> and we&apos;ll handle it.
      </p>
      <h2>Cookies</h2>
      <p>We use one essential cookie to keep you signed in. No ad trackers.</p>
    </ContentPage>
  );
}
