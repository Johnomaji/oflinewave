import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { isMockPaymentsEnabled } from "@/lib/payments";
import { formatNaira } from "@/lib/money";
import { settleMockPayment } from "./actions";

export const metadata = { title: "Test payment", robots: { index: false } };

export default function DevPayPage({ searchParams }: PageProps<"/dev/pay">) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Suspense>
        <DevPay searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function DevPay({ searchParams }: { searchParams: PageProps<"/dev/pay">["searchParams"] }) {
  await connection();
  if (!isMockPaymentsEnabled()) notFound();
  const sp = await searchParams;
  const reference = String(sp.reference ?? "");
  const amount = Number(sp.amount ?? 0);
  const callback = String(sp.callback ?? "/");

  return (
    <div className="w-full max-w-sm rounded-card border border-warning/40 bg-surface p-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-warning">Test mode · no real money</p>
      <h1 className="mt-3 text-3xl font-extrabold">{formatNaira(amount)}</h1>
      <p className="mt-1 font-mono text-sm text-muted">{reference}</p>
      <p className="mt-4 text-sm text-muted">
        PAYSTACK_SECRET_KEY isn&apos;t set, so checkout uses this simulator. Set the key to use real Paystack.
      </p>
      <form action={settleMockPayment} className="mt-6 space-y-3">
        <input type="hidden" name="reference" value={reference} />
        <input type="hidden" name="callback" value={callback} />
        <Button name="outcome" value="success" className="w-full" size="lg">
          Simulate successful payment
        </Button>
        <Button name="outcome" value="failed" variant="outline" className="w-full">
          Simulate failed payment
        </Button>
      </form>
    </div>
  );
}
