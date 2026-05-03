"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, OverviewResponse, AnomalyItem } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Stat } from "@/components/Stat";
import { TrendTable } from "@/components/TrendTable";
import { BarKeywordChart } from "@/components/BarKeywordChart";
import { AIDigest } from "@/components/AIDigest";
import { MonthlyOutlookCard } from "@/components/MonthlyOutlook";
import { CategoryDonut } from "@/components/CategoryDonut";
import { TopMoversArea } from "@/components/TopMoversArea";
import { ContentGapsCard } from "@/components/ContentGaps";
import { SearchConsoleCard } from "@/components/SearchConsoleCard";
import { FreshnessBar } from "@/components/FreshnessBar";
import { SetupChecklist } from "@/components/SetupChecklist";
import { AIDiscovery } from "@/components/AIDiscovery";
import { formatVolume } from "@/lib/format";
import Link from "next/link";

export default function OverviewPage() {
  const [hasAi, setHasAi] = useState(false);
  useEffect(() => {
    api.publicConfig().then((c) => setHasAi(c.has_ai)).catch(() => {});
  }, []);

  const { data, error, isLoading, mutate } = useSWR<OverviewResponse>("/api/trends/overview", api.fetcher);
  const { data: anomalies } = useSWR<AnomalyItem[]>("/api/trends/anomalies", api.fetcher);

  return (
    <div>
      <PageHeader
        title="Genel Bakış"
        subtitle="Türkiye'deki ebeveyn aramalarında bugün ne öne çıkıyor?"
        actions={
          <>
            <a href={api.exportCsvUrl()} className="btn-ghost" target="_blank" rel="noreferrer">
              CSV indir
            </a>
            <button className="btn-ghost" onClick={() => mutate()}>Yenile</button>
          </>
        }
      />

      <SetupChecklist />

      <FreshnessBar />

      <AIDigest hasAi={hasAi} />

      <SearchConsoleCard />

      <ContentGapsCard />

      <AIDiscovery hasAi={hasAi} />

      <MonthlyOutlookCard hasAi={hasAi} />

      {isLoading && <div className="text-sm text-ink-500">Yükleniyor…</div>}
      {error && <div className="text-sm text-red-600">Hata: {String(error.message || error)}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Stat label="Takip edilen kelime" value={data.total_keywords} />
            <Stat
              label="Toplam aylık arama"
              value={
                data.has_volumes
                  ? formatVolume(data.top.reduce((s, r) => s + (r.volume_monthly || 0), 0))
                  : "—"
              }
              hint={data.has_volumes ? "İlk 10'un Google Ads verisi" : "Google Ads bağlanmamış"}
            />
            <Stat label="Hot uyarı" value={data.hot_count} hint=">%50 büyüyen" />
            <Stat label="Anomali" value={anomalies?.length ?? 0} hint="Olağandışı sıçrama" />
          </div>

          {anomalies && anomalies.length > 0 && (
            <section className="card card-pad mb-6 border-amber-100 bg-amber-50/30">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-medium text-ink-900">Anomali Tespiti</h2>
                <span className="text-xs text-ink-500">Tarihsel ortalamadan ≥2σ uzakta</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {anomalies.slice(0, 6).map((a) => (
                  <Link
                    key={a.keyword}
                    href={`/explorer?q=${encodeURIComponent(a.keyword)}`}
                    className="block p-3 rounded-md border border-amber-100 bg-white hover:border-amber-200"
                  >
                    <div className="font-medium text-ink-900 text-sm">{a.keyword}</div>
                    <div className="text-xs text-ink-500 mt-1">
                      Şu an: <span className="text-ink-900 tabular-nums">{a.last_value.toFixed(0)}</span>
                      {" · "}
                      ortalama: <span className="tabular-nums">{a.history_mean.toFixed(0)}</span>
                      {" · "}
                      <span className="text-amber-700">σ: {a.z_score.toFixed(1)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.top.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2">
                <TopMoversArea topKeywords={data.top} />
              </div>
              <CategoryDonut />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="card card-pad">
              <h2 className="font-medium text-ink-900 mb-3">İlk 10 Trend</h2>
              {data.top.length > 0 ? (
                <BarKeywordChart data={data.top} />
              ) : (
                <div className="text-sm text-ink-500 py-6 text-center">Veri yok — Yönetim'den toplama tetikleyin.</div>
              )}
            </section>

            <section className="card card-pad">
              <h2 className="font-medium text-ink-900 mb-3">En Çok Yükselenler</h2>
              <TrendTable rows={data.rising} emptyText="Yükselen kelime yok." />
            </section>

            {data.alerts.length > 0 && (
              <section className="card card-pad lg:col-span-2 border-red-100 bg-red-50/30">
                <h2 className="font-medium text-ink-900 mb-3">Hot Uyarılar</h2>
                <TrendTable rows={data.alerts} />
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
