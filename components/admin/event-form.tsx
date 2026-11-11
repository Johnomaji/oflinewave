"use client";

import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useState, useTransition } from "react";
import { saveEvent } from "@/app/admin/events/actions";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { slugify } from "@/lib/utils";
import { emptyAddOn, emptyTier, type AddOnInput, type EventInput, type TierInput } from "@/lib/validation-admin";

export type VenueOption = { id: string; name: string; city: string };

const CATEGORIES = [
  ["PARTY", "Party"],
  ["CONCERT", "Concert"],
  ["BRUNCH", "Brunch"],
  ["POP_UP", "Pop-up"],
  ["DAY_PARTY", "Day party"],
  ["OTHER", "Other"],
] as const;

export function EventForm({ initial, venues, soldByTier = {} }: { initial: EventInput; venues: VenueOption[]; soldByTier?: Record<string, number> }) {
  const [form, setForm] = useState<EventInput>(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [venueMode, setVenueMode] = useState<"existing" | "new">(venues.length ? "existing" : "new");
  const [lineupText, setLineupText] = useState(initial.lineup.join(", "));
  const [error, setError] = useState<{ error: string; field?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setTier = (i: number, patch: Partial<TierInput>) =>
    setForm((f) => ({ ...f, tiers: f.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  const setAddOn = (i: number, patch: Partial<AddOnInput>) =>
    setForm((f) => ({ ...f, addOns: f.addOns.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const fieldError = (name: string) => (error?.field === name ? error.error : undefined);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");
      set("posterUrl", data.url);
    } catch (e) {
      setError({ error: e instanceof Error ? e.message : "Upload failed", field: "posterUrl" });
    } finally {
      setUploading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: EventInput = {
      ...form,
      lineup: lineupText.split(",").map((s) => s.trim()).filter(Boolean),
      venueId: venueMode === "existing" ? form.venueId : undefined,
      newVenue: venueMode === "new" ? form.newVenue : undefined,
    };
    startTransition(async () => {
      const result = await saveEvent(payload);
      if (result) {
        setError(result);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-8 pb-24" noValidate>
      {error && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          {error.error}
        </p>
      )}

      <Section title="The basics">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => {
                set("title", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
              aria-invalid={!!fieldError("title")}
            />
            <FieldError>{fieldError("title")}</FieldError>
          </div>
          <div>
            <Label htmlFor="slug">URL slug</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", slugify(e.target.value));
              }}
              aria-invalid={!!fieldError("slug")}
            />
            <p className="mt-1 text-xs text-muted">/events/{form.slug || "…"}</p>
            <FieldError>{fieldError("slug")}</FieldError>
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select id="category" value={form.category} onChange={(e) => set("category", e.target.value as EventInput["category"])}>
              {CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input id="tagline" value={form.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} placeholder="One punchy line." />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={6}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              aria-invalid={!!fieldError("description")}
            />
            <p className="mt-1 text-xs text-muted">Blank line = new paragraph. Keep it short.</p>
            <FieldError>{fieldError("description")}</FieldError>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="lineup">Lineup (comma separated)</Label>
            <Input id="lineup" value={lineupText} onChange={(e) => setLineupText(e.target.value)} placeholder="DJ Kaye, Toni Wavy" />
          </div>
        </div>
      </Section>

      <Section title="When & where">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="startsAt">Starts (Lagos time)</Label>
            <Input id="startsAt" type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} aria-invalid={!!fieldError("startsAt")} />
            <FieldError>{fieldError("startsAt")}</FieldError>
          </div>
          <div>
            <Label htmlFor="endsAt">Ends (optional)</Label>
            <Input id="endsAt" type="datetime-local" value={form.endsAt ?? ""} onChange={(e) => set("endsAt", e.target.value)} aria-invalid={!!fieldError("endsAt")} />
            <FieldError>{fieldError("endsAt")}</FieldError>
          </div>
        </div>
        <div className="mt-4 flex gap-2" role="radiogroup" aria-label="Venue">
          {venues.length > 0 && (
            <Button type="button" size="sm" variant={venueMode === "existing" ? "primary" : "outline"} onClick={() => setVenueMode("existing")} role="radio" aria-checked={venueMode === "existing"}>
              Existing venue
            </Button>
          )}
          <Button type="button" size="sm" variant={venueMode === "new" ? "primary" : "outline"} onClick={() => setVenueMode("new")} role="radio" aria-checked={venueMode === "new"}>
            New venue
          </Button>
        </div>
        {venueMode === "existing" ? (
          <div className="mt-4">
            <Label htmlFor="venueId">Venue</Label>
            <Select id="venueId" value={form.venueId ?? ""} onChange={(e) => set("venueId", e.target.value || undefined)} aria-invalid={!!fieldError("venueId")}>
              <option value="">Choose a venue</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.city}
                </option>
              ))}
            </Select>
            <FieldError>{fieldError("venueId")}</FieldError>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(["name", "address", "city", "mapUrl"] as const).map((key) => (
              <div key={key}>
                <Label htmlFor={`venue-${key}`}>{{ name: "Venue name", address: "Address", city: "City", mapUrl: "Map link (optional)" }[key]}</Label>
                <Input
                  id={`venue-${key}`}
                  value={form.newVenue?.[key] ?? ""}
                  onChange={(e) =>
                    set("newVenue", { name: "", address: "", city: "Lagos", ...form.newVenue, [key]: e.target.value })
                  }
                />
                <FieldError>{fieldError(`newVenue.${key}`)}</FieldError>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Poster">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {form.posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary URL
            <img src={form.posterUrl} alt="Poster preview" className="aspect-4/5 w-40 rounded-xl border border-line object-cover" />
          )}
          <div className="flex-1 space-y-3">
            <div>
              <Label htmlFor="posterUrl">Poster URL</Label>
              <Input id="posterUrl" value={form.posterUrl} onChange={(e) => set("posterUrl", e.target.value)} aria-invalid={!!fieldError("posterUrl")} />
              <FieldError>{fieldError("posterUrl")}</FieldError>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2 text-sm hover:border-white/40">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? "Uploading…" : "Upload image"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
            </label>
            <p className="text-xs text-muted">4:5 portrait works best. JPG, PNG, WebP or AVIF, up to 5 MB.</p>
          </div>
        </div>
      </Section>

      <Section title="Tickets">
        <div className="space-y-4">
          {form.tiers.map((tier, i) => {
            const sold = tier.id ? (soldByTier[tier.id] ?? 0) : 0;
            return (
              <Card key={tier.id ?? `new-${i}`} className="bg-ink p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    Tier {i + 1}
                    {sold > 0 && <span className="ml-2 text-xs text-muted">{sold} sold</span>}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={sold > 0 || form.tiers.length === 1}
                    onClick={() => set("tiers", form.tiers.filter((_, j) => j !== i))}
                    aria-label={`Remove tier ${i + 1}`}
                  >
                    <Trash2 /> Remove
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor={`t${i}-name`}>Name</Label>
                    <Input id={`t${i}-name`} value={tier.name} onChange={(e) => setTier(i, { name: e.target.value })} placeholder="Early Bird" />
                  </div>
                  <NumberField id={`t${i}-price`} label="Price (₦, 0 = free)" value={tier.priceNaira} onChange={(v) => setTier(i, { priceNaira: v })} />
                  <NumberField id={`t${i}-qty`} label="Quantity" value={tier.quantity} onChange={(v) => setTier(i, { quantity: v })} min={sold} />
                  <NumberField id={`t${i}-min`} label="Min per order" value={tier.minPerOrder} onChange={(v) => setTier(i, { minPerOrder: v })} min={1} />
                  <NumberField id={`t${i}-max`} label="Max per order" value={tier.maxPerOrder} onChange={(v) => setTier(i, { maxPerOrder: v })} min={1} />
                  <NumberField id={`t${i}-admits`} label="Admits (per ticket)" value={tier.admits} onChange={(v) => setTier(i, { admits: v })} min={1} />
                  <div>
                    <Label htmlFor={`t${i}-vis`}>Visibility</Label>
                    <Select id={`t${i}-vis`} value={tier.visibility} onChange={(e) => setTier(i, { visibility: e.target.value as TierInput["visibility"] })}>
                      <option value="PUBLIC">Public</option>
                      <option value="HIDDEN">Hidden (code only)</option>
                      <option value="MEMBERS">Wave Club members only</option>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`t${i}-start`}>Sales start (optional)</Label>
                    <Input id={`t${i}-start`} type="datetime-local" value={tier.salesStart ?? ""} onChange={(e) => setTier(i, { salesStart: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`t${i}-end`}>Sales end (optional)</Label>
                    <Input id={`t${i}-end`} type="datetime-local" value={tier.salesEnd ?? ""} onChange={(e) => setTier(i, { salesEnd: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <Label htmlFor={`t${i}-desc`}>Perks</Label>
                    <Input id={`t${i}-desc`} value={tier.description ?? ""} onChange={(e) => setTier(i, { description: e.target.value })} placeholder="Fast-lane entry, one welcome drink" />
                  </div>
                </div>
              </Card>
            );
          })}
          <Button type="button" variant="outline" onClick={() => set("tiers", [...form.tiers, emptyTier()])}>
            <Plus /> Add tier
          </Button>
        </div>
      </Section>

      <Section title="Add-ons">
        <p className="-mt-3 mb-4 text-sm text-muted">Drinks, parking, merch, table upgrades. Buyers pre-order at checkout and collect with their QR.</p>
        <div className="space-y-3">
          {form.addOns.map((addOn, i) => (
            <Card key={addOn.id ?? `new-addon-${i}`} className="grid gap-3 bg-ink p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <div>
                <Label htmlFor={`a${i}-name`}>Name</Label>
                <Input id={`a${i}-name`} value={addOn.name} placeholder="Parking pass" onChange={(e) => setAddOn(i, { name: e.target.value })} />
              </div>
              <NumberField id={`a${i}-price`} label="Price (₦)" value={addOn.priceNaira} onChange={(v) => setAddOn(i, { priceNaira: v })} />
              <NumberField id={`a${i}-qty`} label="Quantity" value={addOn.quantity} onChange={(v) => setAddOn(i, { quantity: v })} />
              <NumberField id={`a${i}-max`} label="Max per order" value={addOn.maxPerOrder} onChange={(v) => setAddOn(i, { maxPerOrder: v })} min={1} />
              <div className="flex items-end gap-2">
                <Toggle id={`a${i}-active`} label="On sale" checked={addOn.active} onChange={(v) => setAddOn(i, { active: v })} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove add-on ${i + 1}`} onClick={() => set("addOns", form.addOns.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
              <div className="sm:col-span-2 lg:col-span-5">
                <Label htmlFor={`a${i}-desc`}>Description</Label>
                <Input id={`a${i}-desc`} value={addOn.description ?? ""} placeholder="One car, collect at the gate" onChange={(e) => setAddOn(i, { description: e.target.value })} />
              </div>
            </Card>
          ))}
          <Button type="button" variant="outline" onClick={() => set("addOns", [...form.addOns, emptyAddOn()])}>
            <Plus /> Add add-on
          </Button>
        </div>
      </Section>

      <Section title="Good to know">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField
            id="ageLimit"
            label="Age limit (blank = none)"
            value={form.ageLimit ?? ""}
            onChange={(v) => set("ageLimit", Number.isFinite(v) && v > 0 ? v : null)}
          />
          <div>
            <Label htmlFor="dressCode">Dress code</Label>
            <Input id="dressCode" value={form.dressCode ?? ""} onChange={(e) => set("dressCode", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="refundPolicy">Refund policy</Label>
            <Input id="refundPolicy" value={form.refundPolicy ?? ""} onChange={(e) => set("refundPolicy", e.target.value)} />
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <p className="text-sm font-medium">FAQ</p>
          {form.faqs.map((faq, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-line p-3 md:grid-cols-[1fr_2fr_auto]">
              <Input aria-label={`Question ${i + 1}`} value={faq.q} placeholder="Question" onChange={(e) => set("faqs", form.faqs.map((f, j) => (j === i ? { ...f, q: e.target.value } : f)))} />
              <Input aria-label={`Answer ${i + 1}`} value={faq.a} placeholder="Answer" onChange={(e) => set("faqs", form.faqs.map((f, j) => (j === i ? { ...f, a: e.target.value } : f)))} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove question ${i + 1}`} onClick={() => set("faqs", form.faqs.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set("faqs", [...form.faqs, { q: "", a: "" }])}>
            <Plus /> Add question
          </Button>
        </div>
      </Section>

      <Section title="Publishing & checkout">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" value={form.status} onChange={(e) => set("status", e.target.value as EventInput["status"])}>
              <option value="DRAFT">Draft (hidden)</option>
              <option value="PUBLISHED">Published (on sale)</option>
              <option value="ARCHIVED">Archived (no sales)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="feeMode">Service fee</Label>
            <Select id="feeMode" value={form.feeMode} onChange={(e) => set("feeMode", e.target.value as EventInput["feeMode"])}>
              <option value="DEFAULT">Use default from Settings</option>
              <option value="PASS_TO_BUYER">Pass to buyer</option>
              <option value="ABSORB">Oflinewave absorbs</option>
            </Select>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <Toggle id="listed" label="List publicly (show on /events and home)" checked={form.listed} onChange={(v) => set("listed", v)} />
          <Toggle id="featured" label="Feature on the home page" checked={form.featured} onChange={(v) => set("featured", v)} />
          <Toggle id="names" label="Collect a name for every ticket" checked={form.collectAttendeeNames} onChange={(v) => set("collectAttendeeNames", v)} />
          <Toggle id="transfers" label="Let buyers transfer tickets and change names" checked={form.transfersEnabled} onChange={(v) => set("transfersEnabled", v)} />
          {form.transfersEnabled && (
            <div className="max-w-xs pl-8">
              <NumberField
                id="transferCutoffHours"
                label="Close changes this many hours before start"
                value={form.transferCutoffHours}
                onChange={(v) => set("transferCutoffHours", Number.isFinite(v) ? v : 0)}
              />
            </div>
          )}
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 p-4 backdrop-blur md:left-60">
        <div className="mx-auto flex max-w-5xl justify-end gap-3">
          <Button type="submit" size="lg" disabled={pending || uploading}>
            {pending ? <Loader2 className="animate-spin" /> : null} {form.id ? "Save changes" : "Create event"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-card border border-line bg-surface p-5 md:p-6">
      <legend className="sr-only">{title}</legend>
      <h2 className="mb-5 text-xl font-bold" aria-hidden>
        {title}
      </h2>
      {children}
    </fieldset>
  );
}

function NumberField({ id, label, value, onChange, min = 0 }: { id: string; label: string; value: number | ""; onChange: (v: number) => void; min?: number }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" inputMode="numeric" min={min} value={value} onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} />
    </div>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3 text-sm">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-brand" />
      {label}
    </label>
  );
}
