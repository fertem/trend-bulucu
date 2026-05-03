"use client";

import Link from "next/link";
import { TrendScore } from "@/lib/api";
import { GrowthBadge } from "./GrowthBadge";
import { formatVolume } from "@/lib/format";

export function TrendTable({
  rows,
  emptyText = "Henüz veri yok.",
  showCategory = true,
}: {
  rows: TrendScore[];
  emptyText?: string;
  showCategory?: boolean;
}) {
  if (!rows || rows.length === 0) {
    return <div className="text-sm text-ink-500 py-6 text-center">{emptyText}</div>;
  }

  const hasVolume = rows.some((r) => typeof r.volume_monthly === "number");

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-500">
            <th className="font-medium py-2 pr-4">Kelime</th>
            {showCategory && <th className="font-medium py-2 pr-4">Kategori</th>}
            {hasVolume && <th className="font-medium py-2 pr-4 text-right">Aylık arama</th>}
            <th className="font-medium py-2 pr-4 text-right">Son 7g ilgi</th>
            <th className="font-medium py-2 pr-4 text-right">Değişim</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.keyword} className="border-t border-ink-100 hover:bg-ink-50/50">
              <td className="py-2 pr-4">
                <Link href={`/explorer?q=${encodeURIComponent(r.keyword)}`} className="text-ink-900 hover:text-brand-700">
                  {r.keyword}
                </Link>
              </td>
              {showCategory && (
                <td className="py-2 pr-4">
                  {r.category ? <span className="badge badge-cat">{r.category}</span> : <span className="text-ink-400">—</span>}
                </td>
              )}
              {hasVolume && (
                <td className="py-2 pr-4 text-right tabular-nums">
                  <span className="text-ink-900">{formatVolume(r.volume_monthly)}</span>
                  {typeof r.volume_recent === "number" && r.volume_recent > 0 && r.volume_recent !== r.volume_monthly && (
                    <span className="text-xs text-ink-500 ml-1">/ son3a {formatVolume(r.volume_recent)}</span>
                  )}
                </td>
              )}
              <td className="py-2 pr-4 text-right tabular-nums">{r.avg_last_7.toFixed(1)}</td>
              <td className="py-2 pr-4 text-right">
                <GrowthBadge pct={r.growth_pct} hot={r.is_hot} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
