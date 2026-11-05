import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Scanner } from "@/components/scan/scanner";
import { getActiveEvents } from "@/lib/data/admin";
import { requireScanner } from "@/lib/dal";

export const metadata: Metadata = { title: "Door scanner", robots: { index: false } };
export const viewport: Viewport = { themeColor: "#0A0A0A", width: "device-width", initialScale: 1, maximumScale: 1 };

export default function ScanPage() {
  return (
    <main className="min-h-dvh">
      <Suspense
        fallback={
          <div className="grid min-h-dvh place-items-center">
            <Loader2 className="size-8 animate-spin text-brand" />
          </div>
        }
      >
        <ScanApp />
      </Suspense>
    </main>
  );
}

async function ScanApp() {
  const user = await requireScanner("/scan");
  // From 36h back, so late-night events stay selectable past midnight.
  const events = await getActiveEvents(36, 10);
  return (
    <Scanner
      staffName={user.name ?? user.email}
      events={events.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt.toISOString() }))}
    />
  );
}
