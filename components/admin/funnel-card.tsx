type Funnel = {
  steps: { key: string; label: string; count: number }[];
  referrers: { source: string; count: number }[];
};

/** Horizontal funnel: each step's bar is relative to the first step, with step-to-step conversion. */
export function FunnelCard({ funnel, title }: { funnel: Funnel; title: string }) {
  const top = Math.max(funnel.steps[0]?.count ?? 0, 1);
  return (
    <figure className="rounded-card border border-line bg-surface p-5">
      <figcaption className="mb-4 flex items-baseline justify-between">
        <span className="text-lg font-bold">{title}</span>
        <span className="text-xs text-muted">Cookie-free · unique visitors per day</span>
      </figcaption>
      <ol className="space-y-3">
        {funnel.steps.map((step, i) => {
          const prev = i > 0 ? funnel.steps[i - 1].count : null;
          const rate = prev ? Math.round((step.count / prev) * 100) : null;
          return (
            <li key={step.key}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{step.label}</span>
                <span className="font-semibold">
                  {step.count.toLocaleString("en-NG")}
                  {rate !== null && <span className="ml-2 text-xs font-normal text-muted">{rate}%</span>}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max((step.count / top) * 100, step.count ? 2 : 0)}%`, opacity: 1 - i * 0.15 }} />
              </div>
            </li>
          );
        })}
      </ol>
      {funnel.referrers.length > 0 && (
        <p className="mt-4 text-xs text-muted">
          Top sources: {funnel.referrers.map((r) => `${r.source} (${r.count})`).join(" · ")}
        </p>
      )}
      {funnel.steps[0]?.count === 0 && <p className="mt-4 text-xs text-muted">No traffic recorded yet. Views appear as people visit event pages.</p>}
    </figure>
  );
}
