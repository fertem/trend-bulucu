"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, DigestResponse, SystemFreshness } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useT } from "@/lib/i18n";

type Period = "daily" | "weekly" | "monthly" | "yearly";

const PERIODS: Period[] = ["daily", "weekly", "monthly", "yearly"];

function cacheKey(p: Period) { return `digest-cache-${p}`; }

export function AIDigest({ hasAi }: { hasAi: boolean }) {
  const t = useT();
  const { data: freshness } = useSWR<SystemFreshness>("/api/system/freshness", api.fetcher);
  const [period, setPeriod] = useState<Period>("weekly");
  const [byPeriod, setByPeriod] = useState<Record<Period, { data: DigestResponse | null; at: string | null }>>({
    daily: { data: null, at: null },
    weekly: { data: null, at: null },
    monthly: { data: null, at: null },
    yearly: { data: null, at: null },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cached digests for each period on mount
  useEffect(() => {
    const next = { ...byPeriod };
    for (const p of PERIODS) {
      try {
        const raw = localStorage.getItem(cacheKey(p));
        if (raw) {
          const parsed = JSON.parse(raw);
          // Cache TTL varies by period
          const ttl = p === "daily" ? 1000 * 60 * 60 * 4
                    : p === "weekly" ? 1000 * 60 * 60 * 12
                    : p === "monthly" ? 1000 * 60 * 60 * 24
                    : 1000 * 60 * 60 * 24 * 7;
          if (parsed?.data && Date.now() - parsed.at < ttl) {
            next[p] = { data: parsed.data, at: parsed.iso || new Date(parsed.at).toISOString() };
          }
        }
      } catch {}
    }
    setByPeriod(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = byPeriod[period];

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.digest(period);
      const now = new Date().toISOString();
      setByPeriod((prev) => ({ ...prev, [period]: { data: r, at: now } }));
      try {
        localStorage.setItem(cacheKey(period), JSON.stringify({ at: Date.now(), iso: now, data: r }));
      } catch {}
    } catch (e: any) {
      setError(e.message || t.aiDigest.error);
    } finally {
      setLoading(false);
    }
  };

  if (!hasAi) return null;

  const data = current.data;
  const generatedAt = current.at;
  const overline = t.aiDigest.overlineByPeriod[period] || t.aiDigest.overline;

  return (
    <div className="card card-pad mb-6 border-brand-100 bg-gradient-to-br from-brand-50/60 to-white">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-brand-700 uppercase tracking-wide">{overline}</div>
          <h2 className="text-lg font-semibold text-ink-900 mt-1">
            {data?.headline || t.aiDigest.defaultHeadline}
          </h2>
          <div className="text-xs text-ink-500 mt-0.5">
            {generatedAt ? `${t.aiDigest.aiSummary}: ${relativeTime(generatedAt)}` : t.aiDigest.notGenerated}
            {freshness?.trends_last_collected && (
              <span> · {t.aiDigest.trendData}: {relativeTime(freshness.trends_last_collected)}</span>
            )}
            {freshness?.gsc_last_synced && (
              <span> · {t.aiDigest.sc}: {relativeTime(freshness.gsc_last_synced)}</span>
            )}
            {data?.has_projections && period === "yearly" && (
              <span className="ml-2 text-emerald-700">📈 yıllık projeksiyon dahil</span>
            )}
          </div>
        </div>
        <button className="btn-ghost text-xs whitespace-nowrap" onClick={generate} disabled={loading}>
          {loading ? t.aiDigest.preparing : data ? t.aiDigest.refresh : t.aiDigest.generate}
        </button>
      </div>

      <div className="flex gap-1 mb-4 flex-wrap">
        {PERIODS.map((p) => {
          const active = period === p;
          const cached = !!byPeriod[p].data;
          return (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-3 py-1.5 rounded-md border transition ${
                active
                  ? "bg-brand-100 text-brand-800 border-brand-200 font-medium"
                  : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
              }`}
            >
              {t.aiDigest.period[p]}
              {cached && <span className="ml-1 text-[10px] text-emerald-600">●</span>}
            </button>
          );
        })}
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

      {!data && !loading && !error && (
        <p className="text-sm text-ink-500">{t.aiDigest.intro}</p>
      )}

      {data && (data.highlights?.length > 0 || data.actions?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {data.highlights?.length > 0 && (
            <div>
              <div className="label mb-2">{t.aiDigest.highlights}</div>
              <ul className="space-y-2">
                {data.highlights.map((h, i) => (
                  <li key={i} className="text-sm">
                    <div className="font-medium text-ink-900">{h.title}</div>
                    <div className="text-ink-500">{h.reason}</div>
                    {h.keyword && <span className="badge badge-cat mt-1">{h.keyword}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.actions?.length > 0 && (
            <div>
              <div className="label mb-2">{t.aiDigest.thisWeek}</div>
              <ul className="space-y-2">
                {data.actions.map((a, i) => (
                  <li key={i} className="text-sm">
                    <div className="font-medium text-ink-900">→ {a.action}</div>
                    <div className="text-ink-500">{a.why}</div>
                    <span className="badge badge-up mt-1">{a.channel}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {data?.watch_out && (
        <div className="mt-4 pt-4 border-t border-brand-100/60">
          <div className="label mb-1">{t.aiDigest.watchOut}</div>
          <p className="text-sm text-ink-700">{data.watch_out}</p>
        </div>
      )}
    </div>
  );
}
