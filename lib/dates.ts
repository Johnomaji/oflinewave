const TZ = "Africa/Lagos";

export function formatEventDate(date: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TZ,
  }).format(date);
}

export function formatEventTime(date: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  }).format(date);
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  }).format(date);
}

/** Day + month parts for poster-style date blocks. */
export function dateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    timeZone: TZ,
  }).formatToParts(date);
  return {
    day: parts.find((p) => p.type === "day")?.value ?? "",
    month: (parts.find((p) => p.type === "month")?.value ?? "").toUpperCase(),
  };
}

/** Value for <input type="datetime-local"> in Lagos time (UTC+1, no DST). */
export function toLagosInputValue(date: Date | null | undefined) {
  if (!date) return "";
  const shifted = new Date(date.getTime() + 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

/** Parse a datetime-local value entered in Lagos time. */
export function fromLagosInputValue(value: string) {
  return new Date(`${value}:00+01:00`);
}

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // UTC+1, no DST

/** [start, end) of "tonight": now until 6am Lagos tomorrow. */
export function tonightRange(now = new Date()) {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS);
  const end = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() + 1, 6) - LAGOS_OFFSET_MS);
  return [now, end] as const;
}

/** [start, end) of the coming weekend: Friday 5pm to Monday 6am Lagos (or now, if already in it). */
export function weekendRange(now = new Date()) {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS);
  const day = lagos.getUTCDay(); // 0 Sun … 6 Sat
  const daysToFriday = day === 0 ? -2 : day === 6 ? -1 : 5 - day;
  const friday = Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() + daysToFriday, 17) - LAGOS_OFFSET_MS;
  const monday = friday + (2 * 24 + 13) * 3_600_000;
  return [new Date(Math.max(friday, now.getTime())), new Date(monday)] as const;
}
