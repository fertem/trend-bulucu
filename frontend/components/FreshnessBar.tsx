"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, SystemFreshness } from "@/lib/api";
import { relativeTime } from "@/lib/format";

type Source = {
  label: string;
  value: string | null;
  meta?: string;
};

export function FreshnessBar() {
  const { data, mutate } = useSWR<SystemFreshness>("/api/system/freshness", api.fetcher, {
    refreshInterval: 30_000,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // Refreshing sırasında daha sık yenile
  useEffect(() => {
    if (!refreshing) return;
    const interval = setInterval(() => mutate(), 15_000);
    return () => clearInterval(interval);
  }, [refreshing, mutate]);

  // 12 dakika sonra otomatik kapat (max sürec)
  useEffect(() => {
    if (!startedAt) return;
    const t = setTimeout(() => {
      setRefreshing(false);
      setMsg("Güncelleme tamamlandı (veriler yenilendi).");
    }, 12 * 60 * 1000);
    return () => clearTimeout(t);
  }, [startedAt]);

  // Eğer trends_last_collected güncellendi → güncelleme bitti
  useEffect(() => {
    if (!refreshing || !data?.trends_last_collected || !startedAt) return;
    const collectedAt = new Date(data.trends_last_collected).getTime();
    if (collectedAt > startedAt) {
      setRefreshing(false);
      setMsg("✓ Tüm veri kaynakları güncellendi.");
    }
  }, [data?.trends_last_collected, refreshing, startedAt]);

  const refreshAll = async () => {
    setRefreshing(true);
    setStartedAt(Date.now());
    setMsg("Güncelleme başlatıldı (Pytrends + skor + GSC + içerik fırsatları). ~3-10 dakika sürer.");
    try {
      await api.systemRefreshAll();
    } catch (e: any) {
      setRefreshing(false);
      setMsg(`Hata: ${e.message}`);
    }
  };

  if (!data) return null;

  const sources: Source[] = [
    {
      label: "Trend verisi",
      value: data.trends_last_collected,
      meta: data.trends_last_collected
        ? `${data.trends_succeeded}/${data.trends_attempted} başarı`
        : undefined,
    },
    {
      label: "5y Tarihsel",
      value: data.historical_last_fetched,
      meta: data.historical_succeeded ? `${data.historical_succeeded} kelime` : undefined,
    },
    {
      label: "Site taraması",
      value: data.site_last_scanned,
    },
    {
      label: "Search Console",
      value: data.gsc_last_synced,
      meta: data.gsc_imported_rows ? `${data.gsc_imported_rows} sorgu` : undefined,
    },
    {
      label: "Ads hacmi",
      value: data.ads_volumes_last_fetched,
    },
    {
      label: "İçerik fırsatları",
      value: data.content_gaps_last_refresh,
    },
  ];

  return (
    <div className="card card-pad mb-6 bg-ink-50/50">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-xs font-medium text-ink-500 uppercase tracking-wide">
            Veri Tazelik Durumu
          </div>
          {msg && (
            <div className={`text-xs mt-1 ${msg.startsWith("✓") ? "text-emerald-700" : msg.startsWith("Hata") ? "text-red-600" : "text-ink-700"}`}>
              {msg}
            </div>
          )}
        </div>
        <button
          className="btn-primary text-xs whitespace-nowrap"
          onClick={refreshAll}
          disabled={refreshing}
        >
          {refreshing ? (
            <span className="flex items-center gap-1.5">
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Güncelleniyor…
            </span>
          ) : (
            "Tümünü Güncelle"
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {sources.map((s) => {
          const stale = s.value && Date.now() - new Date(s.value).getTime() > 1000 * 60 * 60 * 30;
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
