"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import useSWR from "swr";
import { api, TrendScore } from "@/lib/api";
import { useT } from "@/lib/i18n";

const CATEGORY_COLORS: Record<string, string> = {
  Kodlama: "#2563eb",
  Eğitim: "#10b981",
  Ebeveynlik: "#f59e0b",
  Psikoloji: "#8b5cf6",
  Eğlence: "#ec4899",
  Diğer: "#94a3b8",
};

export function CategoryDonut() {
  const t = useT();
  const { data } = useSWR<Record<string, TrendScore[]>>("/api/trends/categories", api.fetcher);
  if (!data) return null;

  const counts = Object.entries(data)
    .map(([cat, rows]) => ({
      name: cat,
      value: rows.length,
      avgInterest: rows.reduce((s, r) => s + r.avg_last_7, 0) / Math.max(rows.length, 1),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  if (counts.length === 0) return null;

  const total = counts.reduce((s, c) => s + c.value, 0);

  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between mb-2">
        <h2 className="font-medium text-ink-900">{t.categoryDonut.title}</h2>
        <span className="text-xs text-ink-500">{total} {t.categoryDonut.keywords}</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={counts}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={85}
            paddingAngle={2}
          >
            {counts.map((c, i) => (
              <Cell key={i} fill={CATEGORY_COLORS[c.name] ?? CATEGORY_COLORS.Diğer} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12 }}
            formatter={(v: any, _name: any, ctx: any) => [
              `${v} ${t.categoryDonut.keywords} · ${t.monthlyOutlook.avg} ${ctx.payload.avgInterest.toFixed(1)}`,
              ctx.payload.name,
            ]}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
