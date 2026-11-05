"use client";

import { useActionState, useState } from "react";
import { createManualOrder, type ActionState } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { formatPrice } from "@/lib/money";

type EventOption = { id: string; title: string; tiers: { id: string; name: string; price: number }[] };

export function ManualOrderForm({ events, defaultEventId }: { events: EventOption[]; defaultEventId?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createManualOrder, {});
  const [eventId, setEventId] = useState(defaultEventId ?? events[0]?.id ?? "");
  const [source, setSource] = useState<"COMP" | "CASH">("COMP");
  const tiers = events.find((e) => e.id === eventId)?.tiers ?? [];

  return (
    <Card className="p-6">
      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="eventId">Event</Label>
          <Select id="eventId" name="eventId" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div>
            <Label htmlFor="tierId">Tier</Label>
            <Select id="tierId" name="tierId" key={eventId}>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({formatPrice(t.price)})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input id="quantity" name="quantity" type="number" min={1} max={50} defaultValue={1} />
          </div>
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" name="phone" type="tel" />
          </div>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Type</legend>
          <div className="flex gap-4 text-sm">
            {(["COMP", "CASH"] as const).map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input type="radio" name="source" value={s} checked={source === s} onChange={() => setSource(s)} className="accent-brand" />
                {s === "COMP" ? "Comp (free, guest list)" : "Cash / transfer sale"}
              </label>
            ))}
          </div>
        </fieldset>
        {source === "CASH" && (
          <div>
            <Label htmlFor="amountNaira">Amount received (₦)</Label>
            <Input id="amountNaira" name="amountNaira" type="number" min={0} required />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sendEmail" value="true" defaultChecked className="size-4 accent-brand" />
          Email the tickets
        </label>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending || !tiers.length}>
          {pending ? "Issuing…" : "Issue tickets"}
        </Button>
      </form>
    </Card>
  );
}
