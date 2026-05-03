"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function BarKeywordChart({
  data,
  height = 280,
  dataKey = "avg_last_7",
}: {
  data: { keyword: string; [k: string]: any }[];
  height?: number;
  dataKey?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} />
        <YAxis
          type="category"
          dataKey="keyword"
          stroke="#64748b"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={150}
        />
        <Tooltip
          contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12 }}
        />
        <Bar dataKey={dataKey} fill="#2563eb" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
