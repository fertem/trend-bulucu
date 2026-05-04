"use client";

import { useEffect, useState } from "react";
import { api, YearlyProjection } from "@/lib/api";
import { useT } from "@/lib/i18n";

export function YearlyProjectionCard({ keyword, month }: { keyword: string; month?: number }) {
  const t = useT();
  const [data, setData] = useState<YearlyProjection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    api.keywordProjection(keyword, month)
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => { if (!cancelled) setError(e.message || t.common.error); });
    return () => { cancelled = true; };
  }, [keyword, month]);

  if (error) return null;
  if (!data) return null;

  // Insufficient data — show a soft notice
  if (data.insufficient_data) {
    return (
      <div className="card card-pad bg-ink-50/40">
        <h3 className="font-medium text-ink-900 mb-1">{t.projection.title}</h3>
        <p className="text-xs text-ink-500">{t.projection.insufficientData}</p>
      </div>
    );
  }

  const dirLabel = t.projection.direction[data.direction || "flat"];
  const cagr = data.cagr_pct ?? 0;
  const predicted = data.predicted ?? 0;
  const lo = data.predicted_low ?? 0;
  const hi = data.predicted_high ?? 0;
  const band = Math.max(0, (hi - lo) / 2);
  const maxVal = Math.max(...data.history.map((h) => h.value), predicted, 1);

  return (
    <div className="card card-pad bg-gradient-to-br from-emerald-50/30 to-white border-emerald-100">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-xs font-medium text-emerald-700 uppercase tracking-wide">📈 Projection</div>
          <h3 className="font-semibold text-ink-900 mt-1">{t.projection.title}</h3>
          <p className="text-xs text-ink-500 mt-0.5">{t.projection.subtitle(data.target_month_name)}</p>
        </div>
        <span className={`badge ${
          data.direction === "rising" ? "badge-up" :
          data.direction === "falling" ? "badge-down" :
          "badge-cat"
        }`}>
          {dirLabel}
        </span>
      </div>

      {/* Yearly bars + projected */}
      <div className="flex items-end gap-3 mb-4 min-h-[120px]">
        {data.history.map((h) => {
          const pct = (h.value / maxVal) * 100;
          return (
            <div key={h.year} className="flex-1 flex flex-col items-center">
              <div className="text-xs text-ink-700 tabular-nums mb-1">{h.value.toFixed(0)}</div>
              <div
                className="w-full bg-ink-200 rounded-t"
                style={{ height: `${Math.max(pct, 4)}%`, minHeight: "4px" }}
              />
              <div className="text-xs text-ink-500 mt-1 tabular-nums">{h.year}</div>
            </div>
          );
        })}
        {/* Projection bar */}
        {data.next_year && (
          <div className="flex-1 flex flex-col items-center">
            <div className="text-xs text-emerald-700 tabular-nums mb-1 font-medium">
              {predicted.toFixed(0)}
              <span className="text-ink-500 text-[10px] ml-0.5">±{band.toFixed(0)}</span>
            </div>
            <div
              className="w-full bg-emerald-300 rounded-t border-2 border-emerald-500 border-dashed"
              style={{ height: `${Math.max((predicted / maxVal) * 100, 4)}%`, minHeight: "4px" }}
              title={`${lo.toFixed(0)} – ${hi.toFixed(0)}`}
            />
            <div className="text-xs font-medium text-emerald-700 mt-1 tabular-nums">{data.next_year}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-ink-100 text-xs">
        <div>
          <div className="text-ink-500">{t.projection.cagr}</div>
          <div className={`text-base font-medium tabular-nums mt-0.5 ${
            cagr > 0 ? "text-emerald-700" : cagr < 0 ? "text-red-600" : "text-ink-700"
          }`}>
            {cagr > 0 ? "+" : ""}{cagr.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-ink-500">{data.next_year} {t.projection.predictedLabel}</div>
          <div className="text-base font-medium text-ink-900 tabular-nums mt-0.5">
            {predicted.toFixed(0)} <span className="text-ink-500 text-xs">±{band.toFixed(0)}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-ink-700 mt-3 italic">
        {t.projection.interpretation(keyword, dirLabel.replace(/^[^\s]+\s/, ""), cagr, predicted, data.next_year || 0)}
      </p>
    </div>
  );
}
