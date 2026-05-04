"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, MonthlyOutlook, SeasonalOutlookAI } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useT } from "@/lib/i18n";

export function MonthlyOutlookCard({ hasAi }: { hasAi: boolean }) {
  const t = useT();
  const MONTHS = t.months.long;
  const { data: status } = useSWR<{ has_data: boolean; last_fetched_at: string | null; last_run_status: string | null }>("/api/seasonality/status", api.fetcher);

  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);

  const { data, isLoading } = useSWR<MonthlyOutlook>(
    status?.has_data ? `/api/seasonality/outlook?month=${selectedMonth}` : null,
    api.fetcher
  );

  const [aiData, setAiData] = useState<SeasonalOutlookAI | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    setAiData(null);
    setAiError(null);
    try {
      const raw = localStorage.getItem(`seasonal-ai-cache-m${selectedMonth}`);
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.data && Date.now() - p.at < 1000 * 60 * 60 * 24) {
          setAiData(p.data);
        }
      }
    } catch {}
  }, [selectedMonth]);

  const generateAI = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const r = await api.seasonalOutlookAI(selectedMonth);
      setAiData(r);
      try { localStorage.setItem(`seasonal-ai-cache-m${selectedMonth}`, JSON.stringify({ at: Date.now(), data: r })); } catch {}
    } catch (e: any) {
      setAiError(e.message || t.monthlyOutlook.aiError);
    } finally {
      setAiLoading(false);
    }
  };

  if (!status?.has_data) {
    return (
      <section className="card card-pad mb-6 border-dashed border-ink-200">
        <div className="text-xs font-medium text-ink-500 uppercase tracking-wide">{t.monthlyOutlook.overlineFallback}</div>
        <h2 className="font-medium text-ink-900 mt-1">{t.monthlyOutlook.notFetched}</h2>
        <p className="text-sm text-ink-500 mt-2">{t.monthlyOutlook.notFetchedHint}</p>
      </section>
    );
  }

  const top = data?.by_lift.slice(0, 8) ?? [];
  const monthName = data?.target_month_name ?? MONTHS[selectedMonth - 1];

  return (
    <section className="card card-pad mb-6 border-emerald-100 bg-gradient-to-br from-emerald-50/40 to-white">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-xs font-medium text-emerald-700 uppercase tracking-wide">{t.monthlyOutlook.overline}</div>
          <h2 className="text-lg font-semibold text-ink-900 mt-1">{t.monthlyOutlook.titleQ(monthName)}</h2>
          <div className="text-xs text-ink-500 mt-0.5">
            {t.monthlyOutlook.lastFetch}: {relativeTime(status?.last_fetched_at)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input text-sm py-1.5 px-2"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          >
            {MONTHS.map((name, i) => (
              <option key={i} value={i + 1}>
                {name}{i + 1 === currentMonth ? ` ${t.monthlyOutlook.thisMonth}` : ""}
              </option>
            ))}
          </select>
          {hasAi && (
            <button className="btn-ghost text-xs whitespace-nowrap" onClick={generateAI} disabled={aiLoading}>
              {aiLoading ? t.monthlyOutlook.aiPreparing : aiData ? t.monthlyOutlook.aiRefresh : t.monthlyOutlook.aiPredict}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-ink-500 -mt-2 mb-4">{t.monthlyOutlook.liftHint}</p>

      {aiError && <div className="text-sm text-red-600 mb-3">{aiError}</div>}
      {isLoading && <div className="text-sm text-ink-500 mb-3">{t.common.loading}</div>}

      {aiData && (
        <div className="mb-5 p-4 rounded-md border border-emerald-100 bg-white">
          <div className="font-medium text-ink-900">{aiData.headline}</div>
          {aiData.context && (
            <p className="text-sm text-ink-700 mt-2">
              <span className="label mr-1">{t.monthlyOutlook.context}:</span>{aiData.context}
            </p>
          )}
          {aiData.predictions && aiData.predictions.length > 0 && (
            <div className="mt-3 space-y-2">
              {aiData.predictions.map((p, i) => (
                <div key={i} className="text-sm border-l-2 border-emerald-200 pl-3">
                  <div className="font-medium text-ink-900">→ {p.keyword}</div>
                  <div className="text-ink-700">{p.what_to_expect}</div>
                  <div className="text-ink-500 text-xs mt-0.5">{p.reason}</div>
                </div>
              ))}
            </div>
          )}
          {aiData.early_movers && (
            <div className="mt-3 pt-3 border-t border-emerald-100">
              <span className="label mr-1">{t.monthlyOutlook.earlyMovers}:</span>
              <span className="text-sm text-ink-700">{aiData.early_movers}</span>
            </div>
          )}
        </div>
      )}

      {top.length > 0 && (
        <div>
          <div className="label mb-2">{t.monthlyOutlook.historicalPeak(monthName)}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {top.map((it) => (
              <Link
                key={it.keyword}
                href={`/explorer?q=${encodeURIComponent(it.keyword)}`}
                className="block p-3 rounded-md border border-ink-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30 transition"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink-900 text-sm truncate">{it.keyword}</div>
                    {it.category && <span className="badge badge-cat mt-0.5">{it.category}</span>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-medium tabular-nums ${
                      it.lift_pct > 0 ? "text-emerald-700" : "text-ink-500"
                    }`}>
                      {it.lift_pct > 0 ? "+" : ""}{it.lift_pct.toFixed(0)}%
                    </div>
                    <div className="text-xs text-ink-500">{t.monthlyOutlook.avg}: {it.month_avg.toFixed(0)}</div>
                  </div>
                </div>
                {it.is_seasonal_peak && (
                  <div className="text-xs text-emerald-700 mt-1">{t.monthlyOutlook.yearPeakThis}</div>
                )}
                {!it.is_seasonal_peak && it.peak_month_name && (
                  <div className="text-xs text-ink-500 mt-1">{t.monthlyOutlook.yearPeak}: {it.peak_month_name}</div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
