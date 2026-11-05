"use client";

import { useActionState, useState } from "react";
import { createPromo } from "@/app/admin/promos/actions";
import type { ActionState } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";

type EventOption = { id: string; title: string; tiers: { id: string; name: string; visibility: string }[] };

export function PromoForm({ events }: { events: EventOption[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createPromo, {});
  const [eventId, setEventId] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const tiers = events.find((e) => e.id === eventId)?.tiers ?? [];

  return (
    <Card className="h-fit p-5">
      <h2 className="mb-4 text-lg font-bold">New code</h2>
      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="code">Code</Label>
          <Input id="code" name="code" required placeholder="WAVE20" className="uppercase" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="type">Type</Label>
            <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as "PERCENT" | "FIXED")}>
              <option value="PERCENT">% off</option>
              <option value="FIXED">₦ off</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="value">{type === "PERCENT" ? "Percent" : "Naira"}</Label>
            <Input id="value" name="value" type="number" min={0} max={type === "PERCENT" ? 100 : undefined} required defaultValue={10} />
          </div>
        </div>
        <div>
          <Label htmlFor="eventId">Event</Label>
          <Select id="eventId" name="eventId" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">All events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </Select>
        </div>
        {tiers.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Only these tiers (optional)</legend>
            <div className="space-y-2">
              {tiers.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="tierIds" value={t.id} className="size-4 accent-brand" />
                  {t.name}
                  {t.visibility === "HIDDEN" && <span className="text-xs text-brand">hidden: code unlocks it</span>}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="maxUses">Max uses</Label>
            <Input id="maxUses" name="maxUses" type="number" min={1} placeholder="∞" />
          </div>
          <div>
            <Label htmlFor="expiresAt">Expires</Label>
            <Input id="expiresAt" name="expiresAt" type="datetime-local" />
          </div>
        </div>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p role="status" className="text-sm text-success">
            {state.ok}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating…" : "Create code"}
        </Button>
      </form>
    </Card>
  );
}
