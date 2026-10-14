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
import { ActionFeed } from "@/components/ActionFeed";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { SkeletonStats, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/icons";
import { formatVolume } from "@/lib/format";
import { useT } from "@/lib/i18n";
import Link from "next/link";

export default function OverviewPage() {
  const t = useT();
  const [hasAi, setHasAi] = useState(false);
  useEffect(() => {
    api.publicConfig().then((c) => setHasAi(c.has_ai)).catch(() => {});
  }, []);

  const { data, error, isLoading, mutate } = useSWR<OverviewResponse>("/api/trends/overview", api.fetcher);
  const { data: anomalies } = useSWR<AnomalyItem[]>("/api/trends/anomalies", api.fetcher);

  const hasData = !!data && data.total_keywords > 0;

  return (
    <div>
      <PageHeader
        title={t.dashboard.title}
        subtitle={t.dashboard.subtitle}
        actions={
          <>
            <a href={api.exportCsvUrl()} className="btn-ghost btn-sm" target="_blank" rel="noreferrer">
              <Icon.Download size={14} />
              {t.dashboard.csvDownload}
            </a>
            <button className="btn-ghost btn-sm" onClick={() => mutate()}>
              <Icon.Refresh size={14} />
              {t.dashboard.refresh}
            </button>
          </>
        }
      />

      {/* 1 — Kurulum: bitmişse tek satır, bitmemişse tam rehber */}
      <SetupChecklist />

      {/* 2 — KPI'lar: sayfanın ilk ekranında */}
      {isLoading && <div className="mb-6"><SkeletonStats /></div>}
      {error && (
        <div className="card card-pad mb-6 border-red-100 bg-red-50/40 text-sm text-red-700">
          {t.common.error}: {String(error.message || error)}
        </div>
      )}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat label={t.dashboard.trackedKeywords} value={data.total_keywords} />
          <Stat
            label={t.dashboard.totalMonthlySearch}
            value={
              data.has_volumes
                ? formatVolume(data.top.reduce((s, r) => s + (r.volume_monthly || 0), 0))
                : "—"
            }
            hint={data.has_volumes ? t.dashboard.googleAdsHint : t.dashboard.googleAdsNotConnected}
          />
          <Stat label={t.dashboard.hotAlerts} value={data.hot_count} hint={t.dashboard.hotAlertsHint} tone={data.hot_count > 0 ? "hot" : undefined} />
          <Stat label={t.dashboard.anomalies} value={anomalies?.length ?? 0} hint={t.dashboard.anomaliesHint} tone={(anomalies?.length ?? 0) > 0 ? "warn" : undefined} />
        </div>
      )}

      {/* 3 — Bugün ne yapmalı: kural tabanlı aksiyon akışı */}
      <ActionFeed />

      {/* 4 — Veri tazeliği + "Tümünü güncelle" aksiyonu */}
      <FreshnessBar />

      {/* 4 — Hiç veri yoksa yönlendirici boş durum */}
      {data && !hasData && (
        <section className="card mb-6">
          <EmptyState
            icon={<Icon.Trend size={22} />}
            title={t.dashboard.emptyData}
            action={{ label: t.nav.admin, href: "/admin" }}
          />
        </section>
      )}

      {/* 5 — Anomaliler */}
      {anomalies && anomalies.length > 0 && (
        <section className="card card-pad mb-6 border-amber-100 bg-amber-50/30">
          <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
            <h2 className="card-title">{t.dashboard.anomalyDetection}</h2>
            <span className="text-xs text-ink-500">{t.dashboard.anomalyDistance}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {anomalies.slice(0, 6).map((a) => (
              <Link
                key={a.keyword}
                href={`/explorer?q=${encodeURIComponent(a.keyword)}`}
                className="block p-3 rounded-lg border border-amber-100 bg-surface hover:border-amber-300 hover:shadow-sm transition"
              >
                <div className="font-medium text-ink-900 text-sm truncate">{a.keyword}</div>
                <div className="text-xs text-ink-500 mt-1">
                  {t.dashboard.now}: <span className="text-ink-900 tabular-nums">{a.last_value.toFixed(0)}</span>
                  {" · "}
                  {t.dashboard.average}: <span className="tabular-nums">{a.history_mean.toFixed(0)}</span>
                  {" · "}
                  <span className="text-amber-700">σ: {a.z_score.toFixed(1)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 6 — Grafikler ve tablolar */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <SkeletonCard className="lg:col-span-2" lines={6} />
          <SkeletonCard lines={6} />
        </div>
      )}

      {data && hasData && (
        <>
          {data.top.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2 min-w-0">
                <TopMoversArea topKeywords={data.top} />
              </div>
              <div className="min-w-0">
                <CategoryDonut />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <section className="card card-pad min-w-0">
              <h2 className="card-title mb-3">{t.dashboard.top10Trends}</h2>
              {data.top.length > 0 ? (
                <BarKeywordChart data={data.top} />
              ) : (
                <EmptyState compact title={t.dashboard.emptyData} />
              )}
            </section>

            <section className="card card-pad min-w-0">
              <h2 className="card-title mb-3">{t.dashboard.topRisers}</h2>
              <TrendTable rows={data.rising} emptyText={t.dashboard.noRising} />
            </section>

            {data.alerts.length > 0 && (
              <section className="card card-pad lg:col-span-2 border-red-100 bg-red-50/30 min-w-0">
                <h2 className="card-title mb-3">{t.dashboard.hotAlertsBlock}</h2>
                <TrendTable rows={data.alerts} />
              </section>
            )}
          </div>
        </>
      )}

      {/* 7 — AI özet */}
      <AIDigest hasAi={hasAi} />

      {/* 8 — Büyük tablolar: kırpılmış, "Tümünü göster" ile açılır */}
      <CollapsibleCard maxHeight={440} storageKey="overview-sc">
        <SearchConsoleCard />
      </CollapsibleCard>

      <CollapsibleCard maxHeight={440} storageKey="overview-gaps">
        <ContentGapsCard />
      </CollapsibleCard>

      <AIDiscovery hasAi={hasAi} />

      <MonthlyOutlookCard hasAi={hasAi} />
    </div>
  );
}
