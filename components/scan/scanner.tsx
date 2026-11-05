"use client";

import { AlertTriangle, CheckCircle2, CloudOff, Keyboard, Loader2, RefreshCw, ScanLine, Search, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type EventOption = { id: string; title: string; startsAt: string };
type ScanTicket = { id: string; code: string; holderName: string; tierName: string; admits: number };
type Result =
  | { state: "valid"; ticket: ScanTicket; offline?: boolean; addOns?: ScanAddOn[] }
  | { state: "used"; ticket: ScanTicket; checkedInAt: string; checkedInBy: string | null; offline?: boolean; addOns?: ScanAddOn[] }
  | { state: "wrong_event"; ticket: ScanTicket; eventTitle: string }
  | { state: "invalid"; reason: string; ticket?: ScanTicket };
type ScanAddOn = { id: string; name: string; quantity: number; redeemed: number };
type Stats = { checkedIn: number; total: number };
type LookupTicket = { id: string; code: string; holderName: string; holderEmail: string; tierName: string; status: string; checkedInAt: string | null };

/** [id, code, name, tier, admits, checkedIn, qrFingerprint] */
type ManifestRow = [string, string, string, string, number, 0 | 1, string];
type Manifest = { eventId: string; generatedAt: string; tickets: ManifestRow[] };

const EVENT_KEY = "ow-scan-event";
const manifestKey = (id: string) => `ow-scan-manifest-${id}`;
const queueKey = (id: string) => `ow-scan-queue-${id}`;
/** Small summary string so the UI can subscribe without re-parsing the manifest. */
const metaKey = (id: string) => `ow-scan-meta-${id}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// localStorage as an external store, so React reads it with useSyncExternalStore
// instead of mirroring it into state from effects.
const listeners = new Set<() => void>();
function subscribeStore(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
function writeStore(key: string, value: string) {
  localStorage.setItem(key, value);
  listeners.forEach((l) => l());
}
function writeLocalState(eventId: string, manifest: Manifest | null, queue: string[]) {
  if (manifest) localStorage.setItem(manifestKey(eventId), JSON.stringify(manifest));
  localStorage.setItem(queueKey(eventId), JSON.stringify(queue));
  writeStore(metaKey(eventId), `${manifest?.tickets.length ?? readJson<Manifest | null>(manifestKey(eventId), null)?.tickets.length ?? -1}|${queue.length}`);
}

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** Ticket id from an `OW1.<id>.<sig>` token. Signature is checked by the server when online. */
function ticketIdFromToken(token: string) {
  const parts = token.trim().split(".");
  return (parts.length === 3 || parts.length === 4) && parts[0] === "OW1" ? parts[1] : null;
}

function feedback(ok: boolean) {
  navigator.vibrate?.(ok ? 80 : [120, 60, 120]);
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.35));
    osc.onended = () => ctx.close();
  } catch {
    // audio is best-effort
  }
}

export function Scanner({ events, staffName }: { events: EventOption[]; staffName: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"camera" | "lookup">("camera");
  const [result, setResult] = useState<Result | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastScan = useRef<{ token: string; at: number }>({ token: "", at: 0 });
  const showingResult = useRef(false);

  const savedEvent = useSyncExternalStore(subscribeStore, () => localStorage.getItem(EVENT_KEY) ?? "", () => "");
  const eventId = events.some((e) => e.id === savedEvent) ? savedEvent : (events[0]?.id ?? "");
  const setEventId = (id: string) => writeStore(EVENT_KEY, id);

  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const meta = useSyncExternalStore(subscribeStore, () => localStorage.getItem(metaKey(eventId)) ?? "-1|0", () => "-1|0");
  const [manifestCount, queued] = meta.split("|").map(Number);
  const manifestInfo = manifestCount >= 0 ? `${manifestCount} tickets saved for offline` : null;

  const downloadManifest = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/scan/manifest?event=${eventId}`);
      if (!res.ok) return;
      const manifest = (await res.json()) as Manifest;
      // Keep local offline check-ins marked as used.
      const queue = readJson<string[]>(queueKey(eventId), []);
      const pending = new Set(queue);
      manifest.tickets = manifest.tickets.map((t) => (pending.has(t[0]) ? [t[0], t[1], t[2], t[3], t[4], 1, t[6]] : t));
      writeLocalState(eventId, manifest, queue);
    } catch {
      // offline: keep whatever we have
    }
  }, [eventId]);

  const syncQueue = useCallback(async () => {
    if (!eventId) return;
    const queue = readJson<string[]>(queueKey(eventId), []);
    if (queue.length === 0) return;
    try {
      const res = await fetch("/api/scan/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, ticketIds: queue }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { synced: number; conflicts: { ticketId: string; state: string }[]; stats: Stats };
      // Anything scanned offline while this request was in flight stays queued.
      const remaining = readJson<string[]>(queueKey(eventId), []).filter((id) => !queue.includes(id));
      writeLocalState(eventId, null, remaining);
      setStats(data.stats);
      setSyncNote(
        `Synced ${data.synced} offline check-in${data.synced === 1 ? "" : "s"}` +
          (data.conflicts.length ? `. ${data.conflicts.length} were already scanned by someone else.` : "."),
      );
    } catch {
      // still offline
    }
  }, [eventId]);

  // Per event: cache the manifest and flush the queue now and every minute.
  useEffect(() => {
    if (!eventId) return;
    const tick = () => {
      void syncQueue();
      void downloadManifest();
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    window.addEventListener("online", tick);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      window.removeEventListener("online", tick);
    };
  }, [eventId, downloadManifest, syncQueue]);

  const offlineCheck = useCallback(
    (ticketId: string | null, token?: string): Result => {
      const manifest = readJson<Manifest | null>(manifestKey(eventId), null);
      const row = ticketId ? manifest?.tickets.find((t) => t[0] === ticketId) : undefined;
      if (!manifest) return { state: "invalid", reason: "Offline and no saved ticket list. Reconnect to scan." };
      if (!row) return { state: "invalid", reason: "Not on this event's ticket list" };
      const ticket = { id: row[0], code: row[1], holderName: row[2], tierName: row[3], admits: row[4] };
      if (token && row[6] && !token.trim().endsWith(row[6])) return { state: "invalid", reason: "Old QR. This ticket was transferred", ticket };
      if (row[5] === 1) return { state: "used", ticket, checkedInAt: "", checkedInBy: null, offline: true };

      row[5] = 1;
      writeLocalState(eventId, manifest, [...readJson<string[]>(queueKey(eventId), []), row[0]]);
      return { state: "valid", ticket, offline: true };
    },
    [eventId],
  );

  const submit = useCallback(
    async (payload: { token?: string; ticketId?: string }) => {
      if (!eventId) return;
      setBusy(true);
      let next: Result;
      try {
        if (!navigator.onLine) throw new Error("offline");
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, ...payload }),
        });
        if (res.status === 401) {
          router.push("/login?next=/scan");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { result: Result; stats: Stats };
        next = data.result;
        setStats(data.stats);
      } catch {
        next = offlineCheck(payload.ticketId ?? (payload.token ? ticketIdFromToken(payload.token) : null), payload.token);
      } finally {
        setBusy(false);
      }
      showingResult.current = true;
      setResult(next);
      feedback(next.state === "valid");
    },
    [eventId, offlineCheck, router],
  );

  const dismiss = useCallback(() => {
    showingResult.current = false;
    setResult(null);
  }, []);

  // Auto-dismiss results so the line keeps moving.
  useEffect(() => {
    if (!result || ("addOns" in result && result.addOns?.some((a) => a.redeemed < a.quantity))) return;
    const id = setTimeout(dismiss, result.state === "valid" ? 1800 : 4000);
    return () => clearTimeout(id);
  }, [result, dismiss]);

  // Camera
  useEffect(() => {
    if (mode !== "camera" || !eventId || !videoRef.current) return;
    let scanner: { start(): Promise<void>; stop(): void; destroy(): void } | null = null;
    let cancelled = false;

    void (async () => {
      const { default: QrScanner } = await import("qr-scanner");
      if (cancelled || !videoRef.current) return;
      const instance = new QrScanner(
        videoRef.current,
        (res) => {
          const token = res.data;
          const now = Date.now();
          if (showingResult.current) return;
          if (token === lastScan.current.token && now - lastScan.current.at < 4000) return;
          lastScan.current = { token, at: now };
          void submit({ token });
        },
        { preferredCamera: "environment", highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 8 },
      );
      scanner = instance;
      try {
        await instance.start();
        setCameraError(null);
      } catch {
        setCameraError("Camera blocked. Allow camera access in your browser settings, or use manual lookup.");
      }
    })();

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [mode, eventId, submit]);

  const event = events.find((e) => e.id === eventId);

  if (events.length === 0) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="font-display text-2xl font-bold">No events to scan.</p>
          <p className="mt-2 text-muted">Published events from the last day and upcoming show here.</p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="space-y-3 border-b border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="Oflinewave" width={109} height={32} className="h-8 w-auto" />
            <span className="text-sm font-semibold text-muted">door</span>
          </p>
          <div className="flex items-center gap-2 text-xs">
            {!online && (
              <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 font-semibold text-warning">
                <CloudOff className="size-3.5" /> Offline
              </span>
            )}
            {queued > 0 && <span className="rounded-full bg-white/10 px-2 py-1">{queued} to sync</span>}
          </div>
        </div>
        <label htmlFor="scan-event" className="sr-only">
          Event
        </label>
        <Select id="scan-event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title} · {new Date(e.startsAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" })}
            </option>
          ))}
        </Select>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            {stats ? (
              <>
                <strong className="font-display text-xl text-white">{stats.checkedIn}</strong> / {stats.total} in
              </>
            ) : (
              "Scan to see the count"
            )}
          </span>
          <span className="truncate text-xs text-muted">{staffName}</span>
        </div>
        {syncNote && (
          <p role="status" className="rounded-lg bg-white/5 p-2 text-xs text-muted">
            {syncNote}
          </p>
        )}
      </header>

      <div className="flex gap-2 p-4">
        <Button variant={mode === "camera" ? "primary" : "outline"} className="flex-1" onClick={() => setMode("camera")}>
          <ScanLine /> Scan
        </Button>
        <Button variant={mode === "lookup" ? "primary" : "outline"} className="flex-1" onClick={() => setMode("lookup")}>
          <Keyboard /> Lookup
        </Button>
      </div>

      {mode === "camera" ? (
        <div className="flex-1 px-4 pb-4">
          <div className="relative aspect-square overflow-hidden rounded-card border border-line bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            {busy && (
              <div className="absolute inset-0 grid place-items-center bg-black/50">
                <Loader2 className="size-10 animate-spin text-brand" />
              </div>
            )}
          </div>
          {cameraError ? (
            <p role="alert" className="mt-3 text-sm text-warning">
              {cameraError}
            </p>
          ) : (
            <p className="mt-3 text-center text-sm text-muted">Point at the QR. Hold steady.</p>
          )}
          <div className="mt-4 flex items-center justify-between text-xs text-muted">
            <span>{manifestInfo ?? "Offline list not saved yet"}</span>
            <button type="button" onClick={() => void downloadManifest()} className="flex items-center gap-1 hover:text-white">
              <RefreshCw className="size-3.5" /> Refresh
            </button>
          </div>
        </div>
      ) : (
        <Lookup eventId={eventId} onCheckIn={(ticketId) => void submit({ ticketId })} />
      )}

      {result && <ResultOverlay result={result} eventId={eventId} eventTitle={event?.title ?? ""} onDismiss={dismiss} />}
    </div>
  );
}

function Lookup({ eventId, onCheckIn }: { eventId: string; onCheckIn: (ticketId: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LookupTicket[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/scan/lookup?event=${eventId}&q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { tickets?: LookupTicket[] };
      setResults(data.tickets ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 px-4 pb-4">
      <form onSubmit={search} className="flex gap-2" role="search">
        <label htmlFor="lookup" className="sr-only">
          Name, email, ticket code or order ref
        </label>
        <Input id="lookup" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, code or order ref" autoComplete="off" />
        <Button type="submit" className="h-12" aria-label="Search" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Search />}
        </Button>
      </form>
      <ul className="mt-4 space-y-2">
        {results?.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{t.holderName}</p>
              <p className="truncate text-xs text-muted">
                {t.tierName} · <span className="font-mono">{t.code}</span> · {t.holderEmail}
              </p>
            </div>
            {t.status === "VALID" ? (
              <Button
                size="sm"
                onClick={() => {
                  onCheckIn(t.id);
                  setResults((r) => r?.map((x) => (x.id === t.id ? { ...x, status: "CHECKED_IN" } : x)) ?? null);
                }}
              >
                Check in
              </Button>
            ) : (
              <span className="shrink-0 text-xs text-muted">{t.status.replace("_", " ").toLowerCase()}</span>
            )}
          </li>
        ))}
        {results?.length === 0 && <li className="p-6 text-center text-sm text-muted">No match.</li>}
      </ul>
    </div>
  );
}

function ResultOverlay({ result, eventId, eventTitle, onDismiss }: { result: Result; eventId: string; eventTitle: string; onDismiss: () => void }) {
  const config = {
    valid: { bg: "bg-success", Icon: CheckCircle2, title: "VALID", text: "text-ink" },
    used: { bg: "bg-danger", Icon: XCircle, title: "ALREADY USED", text: "text-white" },
    wrong_event: { bg: "bg-warning", Icon: AlertTriangle, title: "WRONG EVENT", text: "text-ink" },
    invalid: { bg: "bg-warning", Icon: AlertTriangle, title: "INVALID", text: "text-ink" },
  }[result.state];
  const addOns = "addOns" in result ? (result.addOns ?? []) : [];

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label={config.title}
      onClick={onDismiss}
      className={cn("fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto p-8 text-center", config.bg, config.text)}
    >
      <config.Icon className="size-24" strokeWidth={2.5} aria-hidden />
      <p className="mt-6 font-display text-6xl font-extrabold tracking-tight">{config.title}</p>
      {"ticket" in result && result.ticket && (
        <>
          <p className="mt-6 text-3xl font-bold">{result.ticket.holderName}</p>
          <p className="mt-1 text-lg font-semibold opacity-80">
            {result.ticket.tierName}
            {result.ticket.admits > 1 && ` · ADMITS ${result.ticket.admits}`}
          </p>
          <p className="mt-1 font-mono text-sm opacity-70">{result.ticket.code}</p>
        </>
      )}
      {result.state === "used" && (
        <p className="mt-4 text-lg font-semibold">
          {result.checkedInAt
            ? `Scanned ${new Date(result.checkedInAt).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" })}${result.checkedInBy ? ` by ${result.checkedInBy}` : ""}`
            : "Already scanned on this device"}
        </p>
      )}
      {result.state === "wrong_event" && (
        <p className="mt-4 text-lg font-semibold">
          This ticket is for {result.eventTitle}, not {eventTitle}.
        </p>
      )}
      {result.state === "invalid" && <p className="mt-4 text-lg font-semibold">{result.reason}</p>}
      {"offline" in result && result.offline && <p className="mt-4 rounded-full bg-black/20 px-3 py-1 text-sm font-semibold">Offline check. Will sync.</p>}
      {addOns.length > 0 && <AddOnCollect addOns={addOns} eventId={eventId} />}
      <button type="button" onClick={onDismiss} className="mt-10 rounded-full bg-black/20 px-6 py-3 text-sm font-bold">
        Scan next
      </button>
    </div>
  );
}

/** Pre-ordered extras: staff tap to hand each one over. */
function AddOnCollect({ addOns, eventId }: { addOns: ScanAddOn[]; eventId: string }) {
  const [lines, setLines] = useState(addOns);
  const [error, setError] = useState<string | null>(null);

  async function collect(id: string) {
    setError(null);
    const res = await fetch("/api/scan/addons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, orderAddOnId: id }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { ok?: boolean; redeemed?: number; error?: string } | null;
    if (!data?.ok) {
      setError(data?.error ?? "Couldn't update. Check signal.");
      return;
    }
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, redeemed: data.redeemed ?? l.redeemed } : l)));
  }

  return (
    <div className="mt-6 w-full max-w-sm rounded-2xl bg-black/20 p-4 text-left" onClick={(e) => e.stopPropagation()}>
      <p className="text-xs font-bold uppercase tracking-widest opacity-80">Collect at the door</p>
      <ul className="mt-2 space-y-2">
        {lines.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3">
            <span className="font-semibold">
              {l.name} <span className="opacity-70">{l.redeemed}/{l.quantity}</span>
            </span>
            {l.redeemed < l.quantity ? (
              <button type="button" onClick={() => void collect(l.id)} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">
                Hand over 1
              </button>
            ) : (
              <span className="text-sm font-bold">Done</span>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm font-semibold">{error}</p>}
    </div>
  );
}
