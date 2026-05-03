"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { api, KeywordDetailResponse, KeywordItem } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { LineTrendChart } from "@/components/LineTrendChart";
import { GrowthBadge } from "@/components/GrowthBadge";
import { SeasonalityPanel } from "@/components/SeasonalityPanel";
import { UntrackedKeywordPrompt } from "@/components/UntrackedKeywordPrompt";
import { AIDeepAnalysis } from "@/components/AIDeepAnalysis";
import { KeywordIntelligence } from "@/components/KeywordIntelligence";
import { SimilarKeywords } from "@/components/SimilarKeywords";
import { formatVolume, competitionLabel } from "@/lib/format";
import { useT } from "@/lib/i18n";

export default function ExplorerPage() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const initialQ = params.get("q") || "";
  const [query, setQuery] = useState(initialQ);
  const [active, setActive] = useState<string | null>(initialQ || null);
  const [hasAi, setHasAi] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<"insight" | "ideas" | null>(null);

  useEffect(() => {
    api.publicConfig().then((c) => setHasAi(c.has_ai)).catch(() => {});
  }, []);

  const { data: keywords } = useSWR<KeywordItem[]>("/api/trends/keywords", api.fetcher);
  const { data: detail, error, isLoading } = useSWR<KeywordDetailResponse>(
    active ? `/api/trends/keyword/${encodeURIComponent(active)}` : null,
    api.fetcher
  );

  const submit = (kw: string) => {
    setActive(kw);
    setInsight(null);
    setIdeas(null);
    router.replace(`/explorer?q=${encodeURIComponent(kw)}`);
  };

  const askInsight = async () => {
    if (!active) return;
    setAiBusy("insight");
    try {
      const r = await api.insight(active);
      setInsight(r.insight);
    } catch (e: any) {
      setInsight(`Hata: ${e.message}`);
    } finally {
      setAiBusy(null);
    }
  };

  const askIdeas = async () => {
    if (!active) return;
    setAiBusy("ideas");
    try {
      const r = await api.contentIdeas(active);
      setIdeas(r.ideas);
    } catch (e: any) {
      setIdeas(`Hata: ${e.message}`);
    } finally {
      setAiBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title={t.explorer.title} subtitle={t.explorer.subtitle} />

      <form
        onSubmit={(e) => { e.preventDefault(); if (query.trim()) submit(query.trim()); }}
        className="flex gap-2 mb-4 max-w-xl"
      >
        <input
          className="input"
          placeholder={t.explorer.placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          list="keyword-suggestions"
        />
        <button className="btn-primary" type="submit">{t.common.show}</button>
      </form>

      <datalist id="keyword-suggestions">
        {keywords?.map((k) => <option key={k.keyword} value={k.keyword} />)}
      </datalist>

      {keywords && keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {keywords.slice(0, 12).map((k) => (
            <button
              key={k.keyword}
              onClick={() => { setQuery(k.keyword); submit(k.keyword); }}
              className={`text-xs px-2.5 py-1 rounded-md border transition ${
                active === k.keyword
                  ? "bg-brand-50 text-brand-700 border-brand-100"
                  : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
              }`}
            >
              {k.keyword}
            </button>
          ))}
        </div>
      )}

      {!active && <div className="text-sm text-ink-500">{t.explorer.typeOrSelect}</div>}
      {isLoading && <div className="text-sm text-ink-500">{t.common.loading}</div>}
      {error && active && (error as any).status === 404 && (
        <UntrackedKeywordPrompt keyword={active} />
      )}
      {error && (error as any).status !== 404 && (
        <div className="text-sm text-red-600">{t.common.error}: {String((error as any).message || error)}</div>
      )}

      {detail && (
        <div className="space-y-6">
          <div className="card card-pad">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm text-ink-500">{t.common.keyword}</div>
                <div className="text-lg font-semibold text-ink-900">{detail.keyword}</div>
                {detail.score?.category && (
                  <span className="badge badge-cat mt-2">{detail.score.category}</span>
                )}
              </div>
              {detail.score && (
                <div className="text-right">
                  <div className="flex gap-1.5 justify-end items-center">
                    {detail.anomaly?.is_anomaly && (
                      <span className="badge bg-amber-50 text-amber-700 border border-amber-100">
                        {t.explorer.anomaly} σ{detail.anomaly.z_score.toFixed(1)}
                      </span>
                    )}
                    <GrowthBadge pct={detail.score.growth_pct} hot={detail.score.is_hot} />
                  </div>
                  <div className="text-xs text-ink-500 mt-2">
                    {t.explorer.avg7d} <span className="tabular-nums text-ink-700">{detail.score.avg_last_7.toFixed(1)}</span>
                  </div>
                </div>
              )}
            </div>
            <LineTrendChart
              data={detail.timeseries}
              forecast={detail.forecast || []}
              smartForecast={detail.smart_forecast || []}
            />
            {detail.smart_forecast && detail.smart_forecast.length > 0 ? (
              <div className="text-xs text-ink-500 mt-2">
                {t.explorer.forecastLabelSmart}
              </div>
            ) : detail.forecast && detail.forecast.length > 0 ? (
              <div className="text-xs text-ink-500 mt-2">
                {t.explorer.forecastLabelLinear}
              </div>
            ) : null}
          </div>

          <SeasonalityPanel keyword={detail.keyword} />

          {detail.score && typeof detail.score.volume_monthly === "number" && (
            <div className="card card-pad">
              <h3 className="font-medium text-ink-900 mb-3">{t.explorer.googleAdsTitle}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="label">{t.explorer.monthlyAvg}</div>
                  <div className="stat-num mt-1">{formatVolume(detail.score.volume_monthly)}</div>
                  <div className="text-xs text-ink-500 mt-0.5">{t.explorer.last12mTr}</div>
                </div>
                <div>
                  <div className="label">{t.explorer.last3Months}</div>
                  <div className="stat-num mt-1">{formatVolume(detail.score.volume_recent ?? null)}</div>
                  <div className="text-xs text-ink-500 mt-0.5">{t.explorer.monthlyAvgShort}</div>
                </div>
                <div>
                  <div className="label">{t.explorer.competition}</div>
                  <div className="mt-1.5">
                    <span className={`badge ${competitionLabel(detail.score.competition).cls}`}>
                      {competitionLabel(detail.score.competition).text}
                    </span>
                  </div>
                  <div className="text-xs text-ink-500 mt-1">
                    {t.explorer.competitionIndex}: {detail.score.competition_index ?? 0}/100
                  </div>
                </div>
                <div>
                  <div className="label">{t.explorer.bidUsd}</div>
                  <div className="text-base font-medium mt-1 tabular-nums">
                    ${(detail.score.bid_low ?? 0).toFixed(2)} – ${(detail.score.bid_high ?? 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">{t.explorer.topCpcRange}</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card card-pad">
              <h3 className="font-medium text-ink-900 mb-3">{t.explorer.risingRelated}</h3>
              {detail.rising.length === 0 ? (
                <div className="text-sm text-ink-500">{t.common.noData}</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {detail.rising.map((r, i) => (
                    <li key={`${r.keyword}-${i}`} className="flex justify-between border-b border-ink-100 pb-2 last:border-0">
                      <span className="text-ink-900">{r.keyword}</span>
                      <span className="badge badge-up">+%{r.growth.toFixed(0)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card card-pad">
              <h3 className="font-medium text-ink-900 mb-3">{t.explorer.popularRelated}</h3>
              {detail.related_top.length === 0 ? (
                <div className="text-sm text-ink-500">{t.common.noData}</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {detail.related_top.map((r, i) => (
                    <li key={`${r.keyword}-${i}`} className="flex justify-between border-b border-ink-100 pb-2 last:border-0">
                      <span className="text-ink-900">{r.keyword}</span>
                      <span className="text-ink-500 tabular-nums">{r.score.toFixed(0)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {hasAi && (
            <KeywordIntelligence
              keyword={detail.keyword}
              category={detail.score?.category}
            />
          )}

          <SimilarKeywords keyword={detail.keyword} hasAi={hasAi} correlated={detail.correlated} />

          {hasAi && <AIDeepAnalysis keyword={detail.keyword} />}
        </div>
      )}
    </div>
  );
}
