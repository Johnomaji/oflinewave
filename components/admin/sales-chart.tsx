import { formatNaira } from "@/lib/money";

/** Dependency-free bar chart of daily revenue. Accessible as a data table. */
export function SalesChart({ data }: { data: { date: string; revenue: number; tickets: number }[] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const label = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <figure className="rounded-card border border-line bg-surface p-5">
      <figcaption className="mb-6 flex items-baseline justify-between">
        <span className="font-display text-xl font-bold">Sales, last {data.length} days</span>
        <span className="text-sm text-muted">{formatNaira(data.reduce((s, d) => s + d.revenue, 0))}</span>
      </figcaption>
      <div className="flex h-48 items-end gap-1.5" aria-hidden>
        {data.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end">
            <div
              className="min-h-[2px] rounded-t-md bg-brand/80 transition group-hover:bg-brand"
              style={{ height: `${(d.revenue / max) * 100}%` }}
            />
            <div className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-ink px-2 py-1 text-xs group-hover:block">
              {label(d.date)}: {formatNaira(d.revenue)} · {d.tickets} tix
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted" aria-hidden>
        <span>{label(data[0].date)}</span>
        <span>{label(data[data.length - 1].date)}</span>
      </div>
      <table className="sr-only">
        <caption>Daily sales</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Revenue</th>
            <th>Tickets</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{label(d.date)}</td>
              <td>{formatNaira(d.revenue)}</td>
              <td>{d.tickets}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
