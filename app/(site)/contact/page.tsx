import type { Metadata } from "next";
import { Camera, Mail, MessageCircle } from "lucide-react";
import { ContentPage } from "@/components/site/content-page";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Contact", description: "Talk to the Oflinewave team." };

export default async function ContactPage() {
  const settings = await getSettings();
  const channels = [
    { icon: Mail, label: "Email", value: settings.contactEmail, href: `mailto:${settings.contactEmail}` },
    settings.instagramUrl && { icon: Camera, label: "Instagram", value: "DM us", href: settings.instagramUrl },
    settings.tiktokUrl && { icon: MessageCircle, label: "TikTok", value: "Follow along", href: settings.tiktokUrl },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href: string }[];

  return (
    <ContentPage eyebrow="Contact" title="Say what's up." intro="Ticket trouble, partnerships, venue ideas, or you want to DJ. We read everything.">
      <ul className="grid gap-4 !space-y-0 sm:grid-cols-2">
        {channels.map((c) => (
          <li key={c.label} className="!ml-0 !list-none">
            <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center gap-4 rounded-card border border-line bg-surface p-5 !text-white transition hover:border-brand/50 hover:!no-underline">
              <c.icon className="size-6 text-brand" aria-hidden />
              <span>
                <span className="block text-sm text-muted">{c.label}</span>
                <span className="font-semibold">{c.value}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-base text-muted">Ticket issue? Include your order reference (starts with OW-) and we&apos;ll sort it fast.</p>
    </ContentPage>
  );
}
