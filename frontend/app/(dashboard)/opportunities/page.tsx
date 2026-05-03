"use client";

import useSWR from "swr";
import Link from "next/link";
import { api, TrendScore } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { GrowthBadge } from "@/components/GrowthBadge";

export default function OpportunitiesPage() {
  const { data, isLoading, error } = useSWR<TrendScore[]>("/api/trends/opportunities?limit=30", api.fetcher);

  return (
    <div>
      <PageHeader
        title="Fırsatlar"
        subtitle="Yüksek büyüme + henüz doygun olmayan kelimeler. İçerik üretmek için iyi adaylar."
      />

      {isLoading && <div className="text-sm text-ink-500">Yükleniyor…</div>}
      {error && <div className="text-sm text-red-600">Hata: {String((error as any).message || error)}</div>}

      {data && data.length === 0 && (
        <div className="text-sm text-ink-500">Henüz fırsat skoru hesaplanmadı.</div>
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map((s) => (
            <Link
              key={s.keyword}
              href={`/explorer?q=${encodeURIComponent(s.keyword)}`}
              className="card card-pad hover:border-brand-100 hover:bg-brand-50/30 transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium text-ink-900">{s.keyword}</div>
                  {s.category && <span className="badge badge-cat mt-1">{s.category}</span>}
                </div>
                <GrowthBadge pct={s.growth_pct} hot={s.is_hot} />
              </div>
              <div className="grid grid-cols-3 text-xs text-ink-500 mt-3">
                <div>
                  <div className="label">Fırsat</div>
                  <div className="text-base text-ink-900 tabular-nums mt-0.5">{s.opportunity_score.toFixed(0)}</div>
                </div>
                <div>
                  <div className="label">Son 7g</div>
                  <div className="text-base text-ink-900 tabular-nums mt-0.5">{s.avg_last_7.toFixed(1)}</div>
                </div>
                <div>
                  <div className="label">Önceki 7g</div>
                  <div className="text-base text-ink-900 tabular-nums mt-0.5">{s.avg_prev_7.toFixed(1)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
