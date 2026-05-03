export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card card-pad">
      <div className="label">{label}</div>
      <div className="stat-num mt-2">{value}</div>
      {hint && <div className="text-xs text-ink-500 mt-1">{hint}</div>}
    </div>
  );
}
