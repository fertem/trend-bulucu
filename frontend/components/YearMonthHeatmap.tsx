"use client";

import { YoYPoint } from "@/lib/api";
import { useTheme } from "@/lib/theme";

const MONTHS_SHORT = ["O", "Ş", "M", "N", "M", "H", "T", "A", "E", "E", "K", "A"];
const MONTHS_FULL = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                     "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const LIGHT_SCALE = ["#f8fafc", "#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8", "#0ea5e9", "#0369a1", "#0c4a6e"];
const DARK_SCALE  = ["#1e293b", "#0c4a6e", "#075985", "#0369a1", "#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc"];
const STEPS = [0, 10, 25, 40, 55, 70, 85];

function colorFor(value: number, dark: boolean): string {
  const scale = dark ? DARK_SCALE : LIGHT_SCALE;
  if (value === 0) return scale[0];
  for (let i = 1; i < STEPS.length; i++) {
    if (value < STEPS[i]) return scale[i];
  }
  return scale[7];
}

export function YearMonthHeatmap({ data }: { data: YoYPoint[] }) {
  const dark = useTheme().resolved === "dark";
  if (!data || data.length === 0) return null;

  const byYearMonth: Record<number, Record<number, number>> = {};
  data.forEach((p) => {
    byYearMonth[p.year] = byYearMonth[p.year] || {};
    byYearMonth[p.year][p.month] = p.interest;
  });
  const years = Object.keys(byYearMonth).map(Number).sort();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div>
      <div className="flex gap-1 items-center mb-1 ml-10 text-xs text-ink-500">
        {MONTHS_SHORT.map((m, i) => (
          <div key={i} className="w-7 text-center" title={MONTHS_FULL[i]}>{m}</div>
        ))}
      </div>
      <div className="space-y-1">
        {years.map((y) => (
          <div key={y} className="flex gap-1 items-center">
            <div className="w-9 text-xs text-ink-500 tabular-nums shrink-0">{y}</div>
            {Array.from({ length: 12 }, (_, i) => {
              const m = i + 1;
              const v = byYearMonth[y]?.[m] ?? 0;
              const isCurrentCell = y === currentYear && m === currentMonth;
              return (
                <div
                  key={m}
                  className={`w-7 h-6 rounded ${isCurrentCell ? "ring-2 ring-emerald-500" : ""}`}
                  style={{ background: colorFor(v, dark) }}
                  title={`${MONTHS_FULL[i]} ${y}: ${v.toFixed(0)}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs text-ink-500">
        <span>Az</span>
        {[5, 17, 32, 47, 62, 77, 92].map((v) => (
          <div key={v} className="w-5 h-3 rounded" style={{ background: colorFor(v, dark) }} />
        ))}
        <span>Çok</span>
        <span className="ml-3">·</span>
        <span><span className="inline-block w-3 h-3 rounded ring-2 ring-emerald-500 align-middle mr-1" /> şu an olduğun ay</span>
      </div>
    </div>
  );
}
