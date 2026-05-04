"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend, ComposedChart, Area,
} from "recharts";
import { api, MonthProfile, YoYPoint, VsHistoryResponse } from "@/lib/api";
import { YearMonthHeatmap } from "./YearMonthHeatmap";
import { useT } from "@/lib/i18n";

const YEAR_COLORS = ["#94a3b8", "#cbd5e1", "#a78bfa", "#60a5fa", "#2563eb"];

export function SeasonalityPanel({ keyword }: { keyword: string }) {
  const t = useT();
  const MONTH_NAMES = t.months.short;
  const [profile, setProfile] = useState<Record<string, MonthProfile | null> | null>(null);
  const [yoy, setYoy] = useState<YoYPoint[] | null>(null);
  const [vs, setVs] = useState<VsHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setProfile(null); setYoy(null); setVs(null);

    api.seasonalityStatus().then((s) => { if (!cancelled) setHasData(s.has_data); });

    Promise.all([
      api.keywordProfile(keyword).catch(() => null),
      api.keywordYoY(keyword).catch(() => null),
      api.keywordVsHistory(keyword).catch(() => null),
    ]).then(([p, y, v]) => {
      if (cancelled) return;
      setProfile(p);
      setYoy(y);
      setVs(v);
    });

    return () => { cancelled = true; };
  }, [keyword]);

  if (hasData === false) {
    return (
      <div className="card card-pad text-sm text-ink-500">
        {t.seasonality.needHistorical}
      </div>
    );
  }
  if (hasData === null || (!profile && !yoy)) return null;
  if (!profile && !yoy) return null;

  // Bar chart data — current month highlighted
  const currentMonth = new Date().getMonth() + 1;
  const monthBarData = profile
    ? Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const p = profile[String(m)];
        return {
          month: MONTH_NAMES[i],
          mean: p ? p.mean : 0,
          isCurrent: m === currentMonth,
        };
      })
    : [];

  // YoY line chart — pivot to {month, 2022, 2023, 2024, 2025, 2026}
  const yoyByYear: Record<number, Record<number, number>> = {};
  yoy?.forEach((p) => {
    yoyByYear[p.year] = yoyByYear[p.year] || {};
    yoyByYear[p.year][p.month] = p.interest;
  });
  const years = Object.keys(yoyByYear).map(Number).sort();
  const yoyChartData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const row: any = { month: MONTH_NAMES[i] };
    years.forEach((y) => { row[y] = yoyByYear[y]?.[m] ?? null; });
    return row;
  });

  return (
    <div className="space-y-6">
      {vs && (
        <div className="card card-pad">
          <h3 className="font-medium text-ink-900 mb-3">{t.seasonality.vsHistoryTitle(vs.target_month_name)}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="label">{t.seasonality.thisYear}</div>
              <div className="stat-num mt-1">{vs.this_year !== null ? vs.this_year.toFixed(0) : "—"}</div>
              <div className="text-xs text-ink-500 mt-0.5">{vs.target_month_name} {new Date().getFullYear()}</div>
            </div>
            <div>
              <div className="label">{t.seasonality.lastYear}</div>
              <div className="stat-num mt-1">{vs.last_year !== null ? vs.last_year.toFixed(0) : "—"}</div>
              <div className="text-xs text-ink-500 mt-0.5">{t.seasonality.sameMonth} {new Date().getFullYear() - 1}</div>
            </div>
            <div>
              <div className="label">{t.seasonality.avg5y}</div>
              <div className="stat-num mt-1">{vs.history_5y_avg.toFixed(0)}</div>
              <div className="text-xs text-ink-500 mt-0.5">{t.seasonality.historicalBaseline}</div>
            </div>
            <div>
              <div className="label">{t.seasonality.histDelta}</div>
              <div className={`stat-num mt-1 ${
                (vs.delta_vs_history_pct ?? 0) > 0 ? "text-emerald-700" :
                (vs.delta_vs_history_pct ?? 0) < 0 ? "text-red-600" : ""
              }`}>
                {vs.delta_vs_history_pct !== null
                  ? `${vs.delta_vs_history_pct > 0 ? "+" : ""}${vs.delta_vs_history_pct.toFixed(0)}%`
                  : "—"}
              </div>
              {vs.delta_vs_last_year_pct !== null && (
                <div className="text-xs text-ink-500 mt-0.5">
                  {t.seasonality.vsLastYear}: {vs.delta_vs_last_year_pct > 0 ? "+" : ""}{vs.delta_vs_last_year_pct.toFixed(0)}%
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {profile && monthBarData.some((d) => d.mean > 0) && (
        <div className="card card-pad">
          <h3 className="font-medium text-ink-900 mb-3">{t.seasonality.monthlyProfile}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthBarData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="mean" radius={[4, 4, 0, 0]}>
                {monthBarData.map((d, i) => (
                  <Cell key={i} fill={d.isCurrent ? "#10b981" : "#94a3b8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-ink-500 mt-2">{t.seasonality.monthlyProfileHint}</div>
        </div>
      )}

      {yoy && yoy.length > 0 && years.length >= 2 && (
        <div className="card card-pad">
          <h3 className="font-medium text-ink-900 mb-3">{t.seasonality.yearComparison}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={yoyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {years.map((y, i) => (
                <Line
                  key={y}
                  type="monotone"
                  dataKey={y}
                  stroke={YEAR_COLORS[Math.min(i, YEAR_COLORS.length - 1)]}
                  strokeWidth={i === years.length - 1 ? 2.5 : 1.5}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="text-xs text-ink-500 mt-2">{t.seasonality.yearComparisonHint}</div>
        </div>
      )}

      {profile && (() => {
        const currentYear = new Date().getFullYear();
        const bandData = Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const p = (profile as any)[String(m)];
          const thisYearVal = yoy?.find((q) => q.year === currentYear && q.month === m)?.interest ?? null;
          if (!p) return { month: MONTH_NAMES[i], range: [0, 0], median: 0, current: thisYearVal };
          return {
            month: MONTH_NAMES[i],
            range: [p.p25, p.p75],
            median: p.median,
            current: thisYearVal,
          };
        });
        const hasBand = bandData.some((d) => (d.range[1] as number) > 0);
        if (!hasBand) return null;
        return (
          <div className="card card-pad">
            <h3 className="font-medium text-ink-900 mb-3">{t.seasonality.bandTitle}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={bandData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="range" name={t.seasonality.bandLegendRange} fill="#cbd5e1" stroke="none" fillOpacity={0.5} />
                <Line type="monotone" dataKey="median" name={t.seasonality.bandLegendMedian} stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                <Line type="monotone" dataKey="current" name={t.seasonality.bandLegendCurrent(currentYear)} stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="text-xs text-ink-500 mt-2">{t.seasonality.bandHint}</div>
          </div>
        );
      })()}

      {yoy && yoy.length > 0 && (
        <div className="card card-pad">
          <h3 className="font-medium text-ink-900 mb-3">{t.seasonality.heatmapTitle}</h3>
          <YearMonthHeatmap data={yoy} />
          <div className="text-xs text-ink-500 mt-3">{t.seasonality.heatmapHint}</div>
        </div>
      )}
    </div>
  );
}
