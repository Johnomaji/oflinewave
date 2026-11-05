import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { adminChangeTicket, refundOrderAction, refundTicketAction, resendTickets } from "@/app/admin/orders/actions";
import { ActionForm } from "@/components/admin/action-form";
import { AdminSkeleton, OrderStatusBadge, PageHeader, TableWrap, TicketStatusBadge, td, th } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/dates";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";

export const metadata = { title: "Order" };

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminOrder params={params} />
    </Suspense>
  );
}

async function AdminOrder({ params }: Pick<PageProps<"/admin/orders/[id]">, "params">) {
  const { id } = await params;
  await requireAdmin(`/admin/orders/${id}`);

  const order = await db.order.findUnique({
    where: { id },
    include: {
      event: { select: { id: true, title: true, slug: true } },
      items: { include: { tier: { select: { name: true } } } },
      tickets: {
        include: { tier: { select: { name: true } }, checkedInBy: { select: { name: true, email: true } }, transfers: { orderBy: { createdAt: "desc" } } },
        orderBy: { createdAt: "asc" },
      },
      addOns: { include: { addOn: { select: { name: true } } } },
      payments: { orderBy: { createdAt: "desc" } },
      refunds: { include: { createdBy: { select: { email: true } } }, orderBy: { createdAt: "desc" } },
      promoCode: { select: { code: true } },
    },
  });
  if (!order) notFound();

  const logs = await db.auditLog.findMany({
    where: { OR: [{ entity: "Order", entityId: id }, { entity: "Ticket", entityId: { in: order.tickets.map((t) => t.id) } }] },
    include: { actor: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const paid = order.status === "PAID";

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={order.reference}
        description={`${order.event.title} · ${order.source.toLowerCase()} order`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/orders/${order.id}?t=${order.accessToken}`} target="_blank">
              <ExternalLink /> Buyer view
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Buyer</h2>
              <OrderStatusBadge status={order.status} />
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Row label="Name" value={order.buyerName} />
              <Row label="Email" value={order.buyerEmail} />
              <Row label="Phone" value={order.buyerPhone ?? "—"} />
              <Row label="Placed" value={formatDateTime(order.createdAt)} />
              <Row label="Paid" value={order.paidAt ? formatDateTime(order.paidAt) : "—"} />
              <Row label="Promo" value={order.promoCode?.code ?? "—"} />
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-bold">Money</h2>
            <dl className="mt-4 space-y-2 text-sm">
              {order.items.map((i) => (
                <div key={i.id} className="flex justify-between">
                  <dt className="text-muted">
                    {i.quantity} × {i.tier.name}
                  </dt>
                  <dd>{formatNaira(i.unitPrice * i.quantity)}</dd>
                </div>
              ))}
              {order.addOns.map((a) => (
                <div key={a.id} className="flex justify-between">
                  <dt className="text-muted">
                    {a.quantity} × {a.addOn.name} <span className="text-xs">(add-on, {a.redeemed} collected)</span>
                  </dt>
                  <dd>{formatNaira(a.unitPrice * a.quantity)}</dd>
                </div>
              ))}
              {order.discount > 0 && <MoneyRow label="Discount" value={-order.discount} />}
              <MoneyRow label={`Fees (${order.feeMode === "ABSORB" ? "absorbed" : "paid by buyer"})`} value={order.fees} />
              <div className="flex justify-between border-t border-line pt-2 font-bold">
                <dt>Buyer paid</dt>
                <dd>{formatNaira(order.total)}</dd>
              </div>
            </dl>
          </Card>

          <section>
            <h2 className="mb-3 text-lg font-bold">Tickets</h2>
            <TableWrap>
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-line">
                  <tr>
                    <th className={th}>Code</th>
                    <th className={th}>Holder</th>
                    <th className={th}>Tier</th>
                    <th className={th}>Status</th>
                    <th className={th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {order.tickets.map((t) => (
                    <tr key={t.id}>
                      <td className={`${td} font-mono font-semibold`}>{t.code}</td>
                      <td className={td}>
                        {t.holderName}
                        {t.transferredAt && <p className="text-xs text-muted">→ {t.holderEmail}</p>}
                      </td>
                      <td className={`${td} text-muted`}>{t.tier.name}</td>
                      <td className={td}>
                        <TicketStatusBadge status={t.status} />
                        {t.checkedInAt && (
                          <p className="mt-1 text-xs text-muted">
                            {formatDateTime(t.checkedInAt)}
                            {t.checkedInBy && ` by ${t.checkedInBy.name ?? t.checkedInBy.email}`}
                          </p>
                        )}
                      </td>
                      <td className={`${td} text-right`}>
                        {paid && t.status === "VALID" && (
                          <div className="mb-2">
                            <ActionForm action={adminChangeTicket} fields={{ ticketId: t.id, orderId: order.id }} label="Transfer / rename" confirmLabel="Save" pendingLabel="Saving…">
                              <Input name="name" defaultValue={t.holderName} aria-label="Holder name" className="h-9" />
                              <Input name="email" type="email" defaultValue={t.holderEmail} aria-label="Holder email (change to transfer)" className="h-9" />
                            </ActionForm>
                          </div>
                        )}
                        {paid && (t.status === "VALID" || t.status === "CHECKED_IN") && (
                          <ActionForm
                            action={refundTicketAction}
                            fields={{ ticketId: t.id, orderId: order.id }}
                            label="Refund"
                            confirmLabel="Confirm refund"
                            variant="danger"
                            pendingLabel="Refunding…"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                  {order.tickets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted">
                        No tickets issued.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableWrap>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold">Trail</h2>
            <ol className="space-y-2 text-sm">
              {order.payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-4 rounded-xl border border-line p-3">
                  <span>
                    Payment <span className="font-mono">{p.reference}</span> via {p.provider}: <strong>{p.status.toLowerCase()}</strong>
                  </span>
                  <span className="shrink-0 text-muted">{formatDateTime(p.updatedAt)}</span>
                </li>
              ))}
              {order.refunds.map((r) => (
                <li key={r.id} className="flex justify-between gap-4 rounded-xl border border-line p-3">
                  <span>
                    Refund {formatNaira(r.amount)} {r.ticketId ? "(one ticket)" : "(whole order)"}: <strong>{r.status.toLowerCase()}</strong>
                    {r.reason && <span className="text-muted"> · {r.reason}</span>}
                    {r.createdBy && <span className="text-muted"> · {r.createdBy.email}</span>}
                  </span>
                  <span className="shrink-0 text-muted">{formatDateTime(r.createdAt)}</span>
                </li>
              ))}
              {order.tickets.flatMap((t) =>
                t.transfers.map((tr) => (
                  <li key={tr.id} className="flex justify-between gap-4 rounded-xl border border-line p-3">
                    <span>
                      {tr.kind === "TRANSFER" ? "Transfer" : "Name change"} <span className="font-mono">{t.code}</span>: {tr.fromName} ({tr.fromEmail}) → {tr.toName}
                      {tr.kind === "TRANSFER" && ` (${tr.toEmail})`}
                    </span>
                    <span className="shrink-0 text-muted">{formatDateTime(tr.createdAt)}</span>
                  </li>
                )),
              )}
              {logs.map((l) => (
                <li key={l.id} className="flex justify-between gap-4 rounded-xl border border-line/60 p-3 text-muted">
                  <span>
                    {l.action}
                    {l.actor && ` · ${l.actor.email}`}
                  </span>
                  <span className="shrink-0">{formatDateTime(l.createdAt)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          {paid && (
            <Card className="p-5">
              <h2 className="mb-3 font-bold">Resend tickets</h2>
              <ActionForm action={resendTickets} fields={{ orderId: order.id }} label="Send email" pendingLabel="Sending…">
                <label htmlFor="resend-to" className="sr-only">
                  Send to
                </label>
                <Input id="resend-to" name="to" type="email" placeholder={order.buyerEmail} />
                <p className="text-xs text-muted">Leave blank to send to the buyer.</p>
              </ActionForm>
            </Card>
          )}
          {paid && (
            <Card className="border-danger/30 p-5">
              <h2 className="mb-1 font-bold">Refund order</h2>
              <p className="mb-3 text-sm text-muted">
                Returns {formatNaira(order.total)} via {order.payments[0]?.provider ?? "—"} and voids every ticket.
              </p>
              <ActionForm
                action={refundOrderAction}
                fields={{ orderId: order.id }}
                label="Refund everything"
                confirmLabel="Yes, refund this order"
                variant="danger"
                pendingLabel="Refunding…"
              >
                <label htmlFor="reason" className="sr-only">
                  Reason
                </label>
                <Input id="reason" name="reason" placeholder="Reason (optional)" />
              </ActionForm>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="break-all font-medium">{value}</dd>
    </div>
  );
}

function MoneyRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{value < 0 ? `−${formatNaira(-value)}` : formatNaira(value)}</dd>
    </div>
  );
}
