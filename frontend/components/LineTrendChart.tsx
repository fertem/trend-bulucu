"use client";

import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { parseBackendDate } from "@/lib/format";

type Point = {
  date: string;
  interest?: number;
  predicted?: number;
  band?: [number, number];
};

export function LineTrendChart({
  data,
  forecast = [],
  smartForecast = [],
  height = 320,
}: {
  data: { date: string; interest: number }[];
  forecast?: { date: string; predicted: number }[];
  smartForecast?: { date: string; predicted: number; confidence_low: number; confidence_high: number }[];
  height?: number;
}) {
  // Akıllı tahmin varsa onu kullan
  const useSmartForecast = smartForecast.length > 0;
  const fc = useSmartForecast ? smartForecast : forecast.map((f) => ({ ...f, confidence_low: f.predicted, confidence_high: f.predicted }));

  const merged: Point[] = [
    ...data.map((p) => ({ date: p.date, interest: p.interest })),
    ...fc.map((p: any) => ({
      date: p.date,
      predicted: p.predicted,
      band: useSmartForecast ? [p.confidence_low, p.confidence_high] as [number, number] : undefined,
    })),
  ];

  if (data.length > 0 && fc.length > 0) {
    const lastIdx = data.length - 1;
    merged[lastIdx] = {
      ...merged[lastIdx],
      predicted: data[lastIdx].interest,
      band: useSmartForecast ? [data[lastIdx].interest, data[lastIdx].interest] : undefined,
    };
  }

  const formatted = merged.map((p) => ({
    ...p,
    label: (parseBackendDate(p.date) ?? new Date(p.date)).toLocaleDateString("tr-TR", { month: "short", day: "numeric" }),
  }));

  const forecastStartLabel = fc.length > 0 && data.length > 0
    ? (parseBackendDate(data[data.length - 1].date) ?? new Date(data[data.length - 1].date)).toLocaleDateString("tr-TR", { month: "short", day: "numeric" })
    : null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} interval="preserveStartEnd" />
        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
        <Tooltip
          contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12 }}
          formatter={(v: any, name: string) => {
            if (name === "band") return [null, null];
            const num = typeof v === "number" ? v.toFixed(1) : v;
            return [num, name === "interest" ? "İlgi" : name === "predicted" ? "Tahmin" : name];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {forecastStartLabel && (
          <ReferenceLine x={forecastStartLabel} stroke="#94a3b8" strokeDasharray="2 2" label={{ value: "tahmin →", position: "top", fontSize: 10, fill: "#64748b" }} />
        )}
        {useSmartForecast && (
          <Area
            type="monotone"
            dataKey="band"
            name="güven aralığı"
            stroke="none"
            fill="#2563eb"
            fillOpacity={0.12}
            connectNulls={false}
          />
        )}
        <Line type="monotone" dataKey="interest" name="İlgi" stroke="#2563eb" strokeWidth={2.5} dot={false} connectNulls={false} />
        <Line type="monotone" dataKey="predicted" name="Tahmin" stroke="#2563eb" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} opacity={0.7} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
