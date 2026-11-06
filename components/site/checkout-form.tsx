"use client";

import { Loader2, Lock, Minus, Plus, Tag, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { applyCode, type ApplyCodeResult } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { formatNaira, formatPrice } from "@/lib/money";
import { computePricing, type FeeRule } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Tier = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  minPerOrder: number;
  maxPerOrder: number;
  admits: number;
  left: number;
  onSale: boolean;
  offSaleLabel?: string | null;
  membersOnly?: boolean;
  /** members-only tier and this buyer isn't a member (yet) */
  locked?: boolean;
};

type AddOnOption = { id: string; name: string; description: string | null; price: number; maxPerOrder: number; left: number };

type AppliedPromo = Extract<ApplyCodeResult, { ok: true }>["promo"];

export function CheckoutForm({
  eventId,
  tiers: publicTiers,
  addOns = [],
  signInHref,
  signedIn,
  collectAttendeeNames,
  feeRule,
  holdMinutes,
  ageLimit,
  prefill,
}: {
  eventId: string;
  tiers: Tier[];
  addOns?: AddOnOption[];
  signInHref: string;
  signedIn: boolean;
  collectAttendeeNames: boolean;
  feeRule: FeeRule;
  holdMinutes: number;
  ageLimit: number | null;
  prefill: { name: string; email: string };
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [unlocked, setUnlocked] = useState<Tier[]>([]);
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checkingCode, startCodeCheck] = useTransition();
  const [buyer, setBuyer] = useState({ name: prefill.name, email: prefill.email, phone: "" });
  const [attendees, setAttendees] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tiers = useMemo(() => [...unlocked, ...publicTiers], [unlocked, publicTiers]);
  const selected = tiers.filter((t) => (quantities[t.id] ?? 0) > 0);
  const pricing = computePricing(
    selected.map((t) => ({ tierId: t.id, unitPrice: t.price, quantity: quantities[t.id] })),
    feeRule,
    promo,
    addOns.filter((a) => (extras[a.id] ?? 0) > 0).map((a) => ({ unitPrice: a.price, quantity: extras[a.id] })),
  );
  const chosenExtras = addOns.filter((a) => (extras[a.id] ?? 0) > 0);
  const ticketCount = selected.reduce((n, t) => n + quantities[t.id], 0);

  function step(tier: Tier, direction: 1 | -1) {
    setQuantities((prev) => {
      const current = prev[tier.id] ?? 0;
      const max = Math.min(tier.maxPerOrder, tier.left);
      let next = current + direction;
      if (direction === 1 && current === 0) next = tier.minPerOrder;
      if (direction === -1 && next < tier.minPerOrder) next = 0;
      return { ...prev, [tier.id]: Math.max(0, Math.min(next, max)) };
    });
  }

  function submitCode() {
    if (!code.trim()) return;
    setCodeError(null);
    startCodeCheck(async () => {
      const result = await applyCode(eventId, code);
      if (!result.ok) {
        setCodeError(result.error);
        return;
      }
      setPromo(result.promo);
      setUnlocked(result.unlocked.map((t) => ({ ...t, onSale: true })));
      setCode("");
    });
  }

  function removePromo() {
    const lockedIds = new Set(unlocked.map((t) => t.id));
    setQuantities((q) => Object.fromEntries(Object.entries(q).filter(([id]) => !lockedIds.has(id))));
    setUnlocked([]);
    setPromo(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (ticketCount === 0) {
      setError("Pick at least one ticket.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          items: selected.map((t) => ({
            tierId: t.id,
            quantity: quantities[t.id],
            attendeeNames: collectAttendeeNames ? (attendees[t.id] ?? []).slice(0, quantities[t.id]) : undefined,
          })),
          buyer,
          addOns: chosenExtras.map((a) => ({ addOnId: a.id, quantity: extras[a.id] })),
          promoCode: promo?.code,
        }),
      });
      const data = (await res.json()) as { redirectUrl?: string; error?: string };
      if (!res.ok || !data.redirectUrl) throw new Error(data.error ?? "Checkout failed. Try again.");
      window.location.assign(data.redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed. Try again.");
      setSubmitting(false);
    }
  }

  const isFree = pricing.total === 0 && ticketCount > 0;

  return (
    <form onSubmit={submit} className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_340px]" noValidate>
      <div className="space-y-10">
        {/* 1. Tickets */}
        <fieldset>
          <legend className="font-display text-2xl font-extrabold">1. Pick your tickets</legend>
          <ul className="mt-4 space-y-3">
            {tiers.map((tier) => {
              const qty = quantities[tier.id] ?? 0;
              const available = tier.onSale && tier.left > 0 && !tier.locked;
              const atMax = qty >= Math.min(tier.maxPerOrder, tier.left);
              const isUnlocked = unlocked.some((t) => t.id === tier.id);
              return (
                <li
                  key={tier.id}
                  className={cn(
                    "flex items-center justify-between gap-4 rounded-card border bg-surface p-4 transition",
                    qty > 0 ? "border-brand shadow-glow-sm" : "border-line",
                    !available && "opacity-50",
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {tier.name}
                      {isUnlocked && <span className="ml-2 text-xs font-semibold uppercase text-brand">Unlocked</span>}
                      {tier.membersOnly && <span className="ml-2 text-xs font-semibold uppercase text-brand">Wave Club</span>}
                    </p>
                    {tier.description && <p className="text-sm text-muted">{tier.description}</p>}
                    <p className="mt-1 text-sm">
                      <span className="whitespace-nowrap font-semibold text-brand">{formatPrice(tier.price)}</span>
                      {tier.admits > 1 && <span className="whitespace-nowrap text-muted"> · admits {tier.admits}</span>}
                      {available && tier.left <= 20 && <span className="whitespace-nowrap text-muted"> · {tier.left} left</span>}
                      {!available && !tier.locked && <span className="whitespace-nowrap text-muted"> · {tier.onSale ? "Sold out" : (tier.offSaleLabel ?? "Not on sale")}</span>}
                    </p>
                    {tier.locked && (
                      <p className="mt-1 text-xs text-muted">
                        Members only.{" "}
                        {signedIn ? (
                          "Buy any ticket once to join Wave Club."
                        ) : (
                          <Link href={signInHref} className="text-brand underline">
                            Sign in to unlock
                          </Link>
                        )}
                      </p>
                    )}
                  </div>
                  {available && (
                    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`${tier.name} quantity`}>
                      <StepButton label={`Remove one ${tier.name}`} onClick={() => step(tier, -1)} disabled={qty === 0}>
                        <Minus className="size-4" />
                      </StepButton>
                      <output className="w-8 text-center font-display text-lg font-bold" aria-live="polite">
                        {qty}
                      </output>
                      <StepButton label={`Add one ${tier.name}`} onClick={() => step(tier, 1)} disabled={atMax}>
                        <Plus className="size-4" />
                      </StepButton>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Promo / access code */}
          <div className="mt-4">
            {promo ? (
              <div className="flex items-center justify-between rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm">
                <span className="flex items-center gap-2">
                  <Tag className="size-4 text-brand" /> <strong>{promo.code}</strong> applied
                </span>
                <button type="button" onClick={removePromo} className="text-muted hover:text-white" aria-label="Remove code">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div>
                <Label htmlFor="promo">Promo or access code</Label>
                <div className="flex gap-2">
                  <Input
                    id="promo"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitCode();
                      }
                    }}
                    placeholder="WAVE10"
                    autoCapitalize="characters"
                    aria-invalid={!!codeError}
                    aria-describedby="promo-error"
                  />
                  <Button type="button" variant="outline" className="h-12" onClick={submitCode} disabled={checkingCode || !code}>
                    {checkingCode ? <Loader2 className="animate-spin" /> : "Apply"}
                  </Button>
                </div>
                <div id="promo-error">
                  <FieldError>{codeError ?? undefined}</FieldError>
                </div>
              </div>
            )}
          </div>
        </fieldset>

        {addOns.length > 0 && (
          <fieldset>
            <legend className="font-display text-2xl font-extrabold">Extras</legend>
            <p className="mt-1 text-sm text-muted">Pre-order and skip the queue. Collect with your QR at the door.</p>
            <ul className="mt-4 space-y-3">
              {addOns.map((a) => {
                const qty = extras[a.id] ?? 0;
                const max = Math.min(a.maxPerOrder, a.left);
                return (
                  <li
                    key={a.id}
                    className={cn("flex items-center justify-between gap-4 rounded-card border bg-surface p-4", qty > 0 ? "border-brand" : "border-line", a.left === 0 && "opacity-50")}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{a.name}</p>
                      {a.description && <p className="text-sm text-muted">{a.description}</p>}
                      <p className="mt-1 text-sm">
                        <span className="font-semibold text-brand">{formatNaira(a.price)}</span>
                        {a.left === 0 ? <span className="text-muted"> · Sold out</span> : a.left <= 20 && <span className="text-muted"> · {a.left} left</span>}
                      </p>
                    </div>
                    {a.left > 0 && (
                      <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`${a.name} quantity`}>
                        <StepButton label={`Remove one ${a.name}`} onClick={() => setExtras((e) => ({ ...e, [a.id]: Math.max(qty - 1, 0) }))} disabled={qty === 0}>
                          <Minus className="size-4" />
                        </StepButton>
                        <output className="w-8 text-center font-display text-lg font-bold" aria-live="polite">
                          {qty}
                        </output>
                        <StepButton label={`Add one ${a.name}`} onClick={() => setExtras((e) => ({ ...e, [a.id]: Math.min(qty + 1, max) }))} disabled={qty >= max}>
                          <Plus className="size-4" />
                        </StepButton>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        {/* 2. Details */}
        <fieldset className="space-y-4">
          <legend className="font-display text-2xl font-extrabold">2. Your details</legend>
          <p className="text-sm text-muted">Tickets go to this email. No account needed.</p>
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required autoComplete="name" value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={buyer.email}
                onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+234 801 234 5678"
                value={buyer.phone}
                onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })}
              />
            </div>
          </div>
        </fieldset>

        {collectAttendeeNames && ticketCount > 0 && (
          <fieldset className="space-y-4">
            <legend className="font-display text-2xl font-extrabold">3. Who&apos;s coming?</legend>
            <p className="text-sm text-muted">Names go on each ticket. Leave blank to use yours.</p>
            {selected.map((tier) =>
              Array.from({ length: quantities[tier.id] }, (_, i) => (
                <div key={`${tier.id}-${i}`}>
                  <Label htmlFor={`att-${tier.id}-${i}`}>
                    {tier.name} #{i + 1}
                  </Label>
                  <Input
                    id={`att-${tier.id}-${i}`}
                    placeholder={i === 0 ? buyer.name || "Guest name" : "Guest name"}
                    value={attendees[tier.id]?.[i] ?? ""}
                    onChange={(e) =>
                      setAttendees((prev) => {
                        const names = [...(prev[tier.id] ?? [])];
                        names[i] = e.target.value;
                        return { ...prev, [tier.id]: names };
                      })
                    }
                  />
                </div>
              )),
            )}
          </fieldset>
        )}
      </div>

      {/* Summary */}
      <aside className="md:sticky md:top-24 md:self-start">
        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="font-display text-xl font-extrabold">Order summary</h2>
          {ticketCount === 0 ? (
            <p className="mt-4 text-sm text-muted">No tickets yet. Pick a tier to see your total.</p>
          ) : (
            <dl className="mt-4 space-y-2 text-sm">
              {selected.map((t) => (
                <div key={t.id} className="flex justify-between gap-4">
                  <dt className="text-muted">
                    {quantities[t.id]} × {t.name}
                  </dt>
                  <dd>{formatNaira(t.price * quantities[t.id])}</dd>
                </div>
              ))}
              {chosenExtras.map((a) => (
                <div key={a.id} className="flex justify-between gap-4">
                  <dt className="text-muted">
                    {extras[a.id]} × {a.name}
                  </dt>
                  <dd>{formatNaira(a.price * extras[a.id])}</dd>
                </div>
              ))}
              {pricing.discount > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Discount</dt>
                  <dd>−{formatNaira(pricing.discount)}</dd>
                </div>
              )}
              {pricing.fees > 0 && pricing.feeMode === "PASS_TO_BUYER" && (
                <div className="flex justify-between">
                  <dt className="text-muted">Service fee</dt>
                  <dd>{formatNaira(pricing.fees)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
                <dt>Total</dt>
                <dd className="text-brand">{isFree ? "Free" : formatNaira(pricing.total)}</dd>
              </div>
              {pricing.fees > 0 && pricing.feeMode === "ABSORB" && <p className="text-xs text-muted">Fees covered by Oflinewave.</p>}
            </dl>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="mt-5 w-full" disabled={submitting || ticketCount === 0}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" /> {isFree ? "Saving your spot…" : "Heading to payment…"}
              </>
            ) : isFree ? (
              "Reserve my spot"
            ) : (
              <>
                <Lock /> Pay {ticketCount > 0 ? formatNaira(pricing.total) : ""}
              </>
            )}
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {!isFree && `We hold your tickets for ${holdMinutes} minutes while you pay with Paystack. `}
            {ageLimit ? `${ageLimit}+ event, ID checked at the door. ` : ""}
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline hover:text-white">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/refunds" className="underline hover:text-white">
              refund policy
            </Link>
            .
          </p>
        </div>
      </aside>
    </form>
  );
}

function StepButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-10 place-items-center rounded-full border border-line transition hover:border-brand hover:text-brand disabled:opacity-30 disabled:hover:border-line disabled:hover:text-white"
    >
      {children}
    </button>
  );
}
