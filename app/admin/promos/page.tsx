import { Suspense } from "react";
import { togglePromo } from "./actions";
import { PromoForm } from "@/components/admin/promo-form";
import { AdminSkeleton, PageHeader, TableWrap, td, th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";

export const metadata = { title: "Promo codes" };

export default function PromosPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Promos />
    </Suspense>
  );
}

async function Promos() {
  await requireAdmin("/admin/promos");
  const [promos, events] = await Promise.all([
    db.promoCode.findMany({ orderBy: { createdAt: "desc" }, include: { event: { select: { title: true } } } }),
    db.event.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { startsAt: "desc" },
      select: { id: true, title: true, tiers: { select: { id: true, name: true, visibility: true } } },
    }),
  ]);
  const tierNames = new Map(events.flatMap((e) => e.tiers.map((t) => [t.id, t.name] as const)));
  const now = new Date();

  return (
    <>
      <PageHeader title="Promo codes" description="Discounts and access codes. Codes tied to hidden tiers unlock them at checkout." />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <TableWrap>
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className={th}>Code</th>
                <th className={th}>Discount</th>
                <th className={th}>Scope</th>
                <th className={th}>Uses</th>
                <th className={th}>Status</th>
                <th className={th}>
                  <span className="sr-only">Toggle</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {promos.map((p) => {
                const expired = p.expiresAt && p.expiresAt < now;
                const exhausted = p.maxUses !== null && p.uses >= p.maxUses;
                return (
                  <tr key={p.id}>
                    <td className={`${td} font-mono font-bold`}>{p.code}</td>
                    <td className={td}>{p.type === "PERCENT" ? `${p.value}%` : formatNaira(p.value)}</td>
                    <td className={`${td} text-muted`}>
                      {p.event?.title ?? "All events"}
                      {p.tierIds.length > 0 && <p className="text-xs">Tiers: {p.tierIds.map((id) => tierNames.get(id) ?? "?").join(", ")}</p>}
                      {p.expiresAt && <p className="text-xs">Expires {formatDateTime(p.expiresAt)}</p>}
                    </td>
                    <td className={td}>
                      {p.uses}
                      {p.maxUses !== null && ` / ${p.maxUses}`}
                    </td>
                    <td className={td}>
                      <Badge variant={!p.active || expired || exhausted ? "neutral" : "success"}>
                        {!p.active ? "off" : expired ? "expired" : exhausted ? "used up" : "live"}
                      </Badge>
                    </td>
                    <td className={`${td} text-right`}>
                      <form action={togglePromo}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="active" value={String(!p.active)} />
                        <Button variant="ghost" size="sm">
                          {p.active ? "Disable" : "Enable"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
        <PromoForm events={events} />
      </div>
    </>
  );
}
