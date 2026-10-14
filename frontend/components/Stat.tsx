export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** vurgu: hot = kırmızı, warn = amber, ok = yeşil */
  tone?: "hot" | "warn" | "ok";
}) {
  const toneCls =
    tone === "hot" ? "text-red-700"
    : tone === "warn" ? "text-amber-700"
    : tone === "ok" ? "text-emerald-700"
    : "text-ink-900";
  return (
    <div className="card card-pad min-w-0">
      <div className="label truncate">{label}</div>
      <div className={`stat-num mt-2 ${toneCls}`}>{value}</div>
      {hint && <div className="text-xs text-ink-500 mt-1.5 truncate">{hint}</div>}
    </div>
  );
}
