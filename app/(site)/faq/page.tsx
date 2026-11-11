import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/site/content-page";

export const metadata: Metadata = { title: "FAQ", description: "Tickets, entry, refunds and the phones-down thing." };

const FAQS: { q: string; a: React.ReactNode }[] = [
  { q: "Do I need an account to buy tickets?", a: "No. Check out as a guest with your email. Your tickets land in your inbox." },
  {
    q: "Where are my tickets?",
    a: (
      <>
        In your email (with a PDF), and in <Link href="/tickets">My tickets</Link>. Lost the email? Enter the address you used and we&apos;ll send a link.
      </>
    ),
  },
  { q: "How do I pay?", a: "Card, bank transfer or USSD through Paystack. We never see your card details." },
  { q: "Can I screenshot my QR?", a: "Yes. But each QR scans once. If someone else uses your screenshot first, you're not getting in. Keep it to yourself." },
  { q: "What's with the phones?", a: "Keep it in your pocket. Some nights we pouch phones at the door. You'll get it back on the way out, promise." },
  { q: "Is there an age limit?", a: "Most nights are 18+. It's on every event page. Bring ID." },
  {
    q: "Can I get a refund?",
    a: (
      <>
        If we cancel or move an event, yes. Otherwise tickets are non-refundable but usually transferable. Full details in our <Link href="/refunds">refund policy</Link>.
      </>
    ),
  },
  { q: "Can I give my ticket to a friend?", a: "Usually, yes, up to 24 hours before doors. Message us with your order reference and their name and email." },
  { q: "An event is sold out. Now what?", a: "Join the waitlist on the event page. If tickets free up, waitlisters hear first." },
];

export default function FaqPage() {
  return (
    <ContentPage title="FAQ" intro="Everything you need before you hit the floor.">
      <div className="divide-y divide-line rounded-card border border-line bg-surface">
        {FAQS.map((f) => (
          <details key={f.q} className="group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-white">
              {f.q}
              <span className="text-brand transition group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="mt-3 text-base text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </ContentPage>
  );
}
