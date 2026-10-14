"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useChartTheme } from "@/lib/theme";

const ROW_HEIGHT = 30;   // her çubuk için ayrılan dikey alan
const LABEL_MAX = 24;    // Y ekseni etiketinde gösterilecek en fazla karakter
const LABEL_WIDTH = 165;

function truncate(s: string, max = LABEL_MAX) {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export function BarKeywordChart({
  data,
  height,
  dataKey = "avg_last_7",
}: {
  data: { keyword: string; [k: string]: any }[];
  /** verilmezse satır sayısına göre hesaplanır (etiketler üst üste binmez) */
  height?: number;
  dataKey?: string;
}) {
  const ct = useChartTheme();
  const autoHeight = Math.max(160, data.length * ROW_HEIGHT + 24);
  const h = height ? Math.max(height, autoHeight) : autoHeight;

  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }} barCategoryGap={6}>
        <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" stroke={ct.axis} fontSize={12} tickLine={false} />
        <YAxis
          type="category"
          dataKey="keyword"
          stroke={ct.axis}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={LABEL_WIDTH}
          interval={0}
          tick={(props: any) => {
            const full = String(props.payload?.value ?? "");
            return (
              <text x={props.x} y={props.y} dy={4} textAnchor="end" fill={ct.axis} fontSize={12}>
                <title>{full}</title>
                {truncate(full)}
              </text>
            );
          }}
        />
        <Tooltip
          cursor={{ fill: ct.grid, fillOpacity: 0.35 }}
          contentStyle={{ ...ct.tooltip.contentStyle, fontSize: 12 }}
          labelStyle={ct.tooltip.labelStyle}
          itemStyle={ct.tooltip.itemStyle}
          labelFormatter={(label: string) => String(label)}
        />
        <Bar dataKey={dataKey} fill="#2563eb" radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
