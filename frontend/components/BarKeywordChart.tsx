"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useChartTheme } from "@/lib/theme";

export function BarKeywordChart({
  data,
  height = 280,
  dataKey = "avg_last_7",
}: {
  data: { keyword: string; [k: string]: any }[];
  height?: number;
  dataKey?: string;
}) {
  const ct = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 0 }}>
        <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" stroke={ct.axis} fontSize={12} tickLine={false} />
        <YAxis
          type="category"
          dataKey="keyword"
          stroke={ct.axis}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={150}
        />
        <Tooltip
          contentStyle={{ ...ct.tooltip.contentStyle, fontSize: 12 }} labelStyle={ct.tooltip.labelStyle} itemStyle={ct.tooltip.itemStyle}
        />
        <Bar dataKey={dataKey} fill="#2563eb" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
