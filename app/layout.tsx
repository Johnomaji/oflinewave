import type { Metadata, Viewport } from "next";
import { Inter, Syne } from "next/font/google";
import Script from "next/script";
import { ServiceWorkerRegister } from "@/components/site/sw-register";
import { appUrl } from "@/lib/utils";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const syne = Syne({ variable: "--font-syne", subsets: ["latin"], weight: ["600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "Oflinewave · Get offline. Get loud.", template: "%s · Oflinewave" },
  description: "Parties, concerts and day-time link-ups in Lagos. Put the phone down and ride the wave with real people.",
  applicationName: "Oflinewave",
  openGraph: { type: "website", siteName: "Oflinewave", locale: "en_NG" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${syne.variable}`}>
      <body className="grain flex min-h-dvh flex-col">
        {children}
        <ServiceWorkerRegister />
        {/* Optional, cookie-free page analytics alongside our own ticket funnel. */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script defer data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN} src="https://plausible.io/js/script.js" strategy="afterInteractive" />
        )}
      </body>
    </html>
  );
}
