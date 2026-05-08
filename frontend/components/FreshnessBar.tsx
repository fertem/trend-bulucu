"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, SystemFreshness, CurrentRunResponse } from "@/lib/api";
import { relativeTime, parseBackendDate } from "@/lib/format";
import { useT } from "@/lib/i18n";

type Source = {
  label: string;
  value: string | null;
  meta?: string;
};

export function FreshnessBar() {
  const t = useT();
  const { data, mutate } = useSWR<SystemFreshness>("/api/system/freshness", api.fetcher, {
    refreshInterval: 30_000,
  });

  // Live current-run state — polled every 5s while a run is active
  const { data: runState, mutate: mutateRun } = useSWR<CurrentRunResponse>(
    "/api/admin/current-run",
    api.fetcher,
    { refreshInterval: 5_000 },
  );

  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isRunning = runState?.run?.status === "running";
  const cooldown = runState?.cooldown;
  const lastRun = runState?.run;

  // While a run is in progress, mirror it into local state so button stays disabled
  useEffect(() => {
    if (isRunning) setRefreshing(true);
    else setRefreshing(false);
  }, [isRunning]);

  // When a run finishes, surface the result
  useEffect(() => {
    if (!lastRun) return;
    if (lastRun.status === "running") return;
    if (lastRun.status === "rate_limited") {
      setMsg(t.freshness.rateLimited);
    } else if (lastRun.status === "success") {
      setMsg(t.freshness.done);
    } else if (lastRun.status === "partial") {
      setMsg(t.freshness.partialSuccess(lastRun.succeeded || 0, lastRun.attempted || 0));
    } else if (lastRun.status === "failed") {
      setMsg(`${t.freshness.runFailed} ${lastRun.error || ""}`);
    }
  }, [lastRun?.status, lastRun?.error, lastRun?.succeeded, lastRun?.attempted, t]);

  const refreshAll = async (force = false) => {
    setRefreshing(true);
    setMsg(force
      ? "🔄 Tüm kelimeler zorla yenileniyor — taze olanlar da yeniden çekilecek."
      : "▶ Eksik / bayat kelimeler tamamlanıyor. Taze olanlar atlanır (kaldığı yerden devam).");
    try {
      await api.systemRefreshAll(force);
      mutate();
      mutateRun();
    } catch (e: any) {
      setRefreshing(false);
      setMsg(`${t.common.error}: ${e.message}`);
    }
  };

  if (!data) return null;

  const sources: Source[] = [
    {
      label: t.freshness.sources.trends,
      value: data.trends_last_collected,
      meta: data.trends_last_collected
        ? t.freshness.successCount(data.trends_succeeded, data.trends_attempted)
        : undefined,
    },
    {
      label: t.freshness.sources.historical,
      value: data.historical_last_fetched,
      meta: data.historical_succeeded ? t.freshness.keywordsCount(data.historical_succeeded) : undefined,
    },
    { label: t.freshness.sources.site, value: data.site_last_scanned },
    {
      label: t.freshness.sources.gsc,
      value: data.gsc_last_synced,
      meta: data.gsc_imported_rows ? t.freshness.queriesCount(data.gsc_imported_rows) : undefined,
    },
    { label: t.freshness.sources.ads, value: data.ads_volumes_last_fetched },
    { label: t.freshness.sources.gaps, value: data.content_gaps_last_refresh },
  ];

  const cooldownActive = cooldown?.blocked && (cooldown.remaining_seconds || 0) > 0;
  const cooldownMins = cooldown?.remaining_seconds ? Math.ceil(cooldown.remaining_seconds / 60) : 0;

  return (
    <div className="card card-pad mb-6 bg-ink-50/50">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-xs font-medium text-ink-500 uppercase tracking-wide">
            {t.freshness.overline}
          </div>
          {isRunning && lastRun && (
            <div className="text-xs mt-1 text-ink-700">
              {t.freshness.progress(lastRun.succeeded || 0, lastRun.attempted || 0)}
            </div>
          )}
          {!isRunning && msg && (
            <div className={`text-xs mt-1 ${
              msg.startsWith("✓") ? "text-emerald-700" :
              msg.startsWith("❌") ? "text-red-600" :
              msg.startsWith(t.common.error) ? "text-red-600" :
              "text-ink-700"
            }`}>
              {msg}
            </div>
          )}
          {cooldownActive && (
            <div className="mt-2 p-2.5 rounded-md bg-amber-50 border border-amber-100 text-xs">
              <div className="font-medium text-amber-800">⏳ {t.freshness.cooldownActive(cooldownMins)}</div>
              <div className="text-ink-700 mt-1">{t.freshness.cooldownInfo}</div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-primary text-xs whitespace-nowrap"
            onClick={() => refreshAll(false)}
            disabled={refreshing}
            title="Eksik / bayat kelimeler — taze olanları atlar"
          >
            {refreshing ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t.freshness.updating}
              </span>
            ) : (
              t.freshness.refreshAll
            )}
          </button>
          {!refreshing && (
            <button
              className="text-xs text-ink-500 hover:text-amber-700 underline whitespace-nowrap"
              onClick={() => refreshAll(true)}
              title="Tüm kelimeleri zorla yeniden çeker (taze olanları da). Daha çok API kotası harcar."
            >
              ↻ Zorla yenile
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {sources.map((s) => {
          const parsed = parseBackendDate(s.value);
          const stale = parsed && Date.now() - parsed.getTime() > 1000 * 60 * 60 * 30;
          return (
            <div key={s.label}>
              <div className="text-[11px] text-ink-500">{s.label}</div>
              <div className={`text-sm font-medium tabular-nums ${stale ? "text-amber-700" : "text-ink-900"}`}>
                {relativeTime(s.value)}
              </div>
              {s.meta && <div className="text-[10px] text-ink-500">{s.meta}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
