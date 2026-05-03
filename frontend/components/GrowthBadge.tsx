export function GrowthBadge({ pct, hot }: { pct: number; hot?: boolean }) {
  if (hot) return <span className="badge badge-hot">HOT · %{pct.toFixed(0)}</span>;
  if (pct > 0) return <span className="badge badge-up">↑ %{pct.toFixed(0)}</span>;
  if (pct < 0) return <span className="badge badge-down">↓ %{Math.abs(pct).toFixed(0)}</span>;
  return <span className="badge badge-down">—</span>;
}
