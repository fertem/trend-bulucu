"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api, TrendScore } from "@/lib/api";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

type Series = {
  date: string;
  [keyword: string]: number | string;
};

export function TopMoversArea({ topKeywords }: { topKeywords: TrendScore[] }) {
  const [series, setSeries] = useState<Series[] | null>(null);
  const top5 = topKeywords.slice(0, 5).map((s) => s.keyword);

  useEffect(() => {
    if (top5.length === 0) {
      setSeries(null);
      return;
    }
    let cancelled = false;
    Promise.all(
      top5.map((kw) =>
        api
          .keyword(kw)
          .then((d) => ({
            keyword: kw,
            points: d.timeseries.map((p) => ({ date: p.date, interest: p.interest })),
          }))
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      const byDate: Record<string, Series> = {};
      results.forEach((r) => {
        if (!r) return;
        r.points.forEach((p) => {
          const key = p.date.slice(0, 10);
          if (!byDate[key]) byDate[key] = { date: key };
          byDate[key][r.keyword] = p.interest;
        });
      });
      const sorted = Object.values(byDate).sort((a, b) => (a.date as string).localeCompare(b.date as string));
      setSeries(sorted);
    });
    return () => { cancelled = true; };
  }, [topKeywords.map((s) => s.keyword).join("|")]);

  if (!series || series.length === 0 || top5.length === 0) return null;

  const formatted = series.map((p) => ({
    ...p,
    label: new Date(p.date as string).toLocaleDateString("tr-TR", { month: "short", day: "numeric" }),
  }));

  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between mb-2">
        <h2 className="font-medium text-ink-900">Top 5 Trend · Son 30 Gün</h2>
        <span className="text-xs text-ink-500">karşılaştırma</span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} interval="preserveStartEnd" />
          <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
          {top5.map((kw, i) => (
            <Area
              key={kw}
              type="monotone"
              dataKey={kw}
              stroke={COLORS[i]}
              fill={COLORS[i]}
              fillOpacity={0.15}
              strokeWidth={2}
              connectNulls
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
