type CalendarEvent = { title: string; description: string; location: string; startsAt: Date; endsAt: Date | null; url: string };

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
}

function end(e: CalendarEvent) {
  return e.endsAt ?? new Date(e.startsAt.getTime() + 4 * 3_600_000);
}

export function googleCalendarUrl(e: CalendarEvent) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsDate(e.startsAt)}/${icsDate(end(e))}`,
    details: `${e.description}\n\n${e.url}`,
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function toIcs(e: CalendarEvent & { uid: string }) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Oflinewave//Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.uid}@oflinewave`,
    `DTSTAMP:${icsDate(e.startsAt)}`,
    `DTSTART:${icsDate(e.startsAt)}`,
    `DTEND:${icsDate(end(e))}`,
    `SUMMARY:${icsEscape(e.title)}`,
    `DESCRIPTION:${icsEscape(`${e.description}\n\n${e.url}`)}`,
    `LOCATION:${icsEscape(e.location)}`,
    `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
