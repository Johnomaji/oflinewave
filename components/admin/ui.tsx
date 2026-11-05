import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { EventStatus, OrderStatus, TicketStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

export { ProgressBar } from "@/components/ui/progress";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-4xl font-extrabold">{title}</h1>
        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-card border bg-surface p-5", accent ? "border-brand/50" : "border-line")}>
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className={cn("mt-2 font-display text-3xl font-extrabold", accent && "text-brand")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const ORDER_VARIANT: Record<OrderStatus, "success" | "warning" | "danger" | "neutral"> = {
  PAID: "success",
  PENDING: "warning",
  FAILED: "danger",
  REFUNDED: "neutral",
  CANCELLED: "neutral",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_VARIANT[status]}>{status.toLowerCase()}</Badge>;
}

const EVENT_VARIANT: Record<EventStatus, "success" | "neutral" | "outline"> = {
  PUBLISHED: "success",
  DRAFT: "outline",
  ARCHIVED: "neutral",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge variant={EVENT_VARIANT[status]}>{status.toLowerCase()}</Badge>;
}

const TICKET_VARIANT: Record<TicketStatus, "success" | "neutral" | "danger"> = {
  VALID: "success",
  CHECKED_IN: "neutral",
  REFUNDED: "danger",
  CANCELLED: "danger",
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant={TICKET_VARIANT[status]}>{status.replace("_", " ").toLowerCase()}</Badge>;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-card border border-line bg-surface">{children}</div>;
}

export const th = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted";
export const td = "px-4 py-3 align-middle";

export function AdminSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-10 w-64 animate-pulse rounded-xl bg-surface" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-card bg-surface" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-card bg-surface" />
    </div>
  );
}
