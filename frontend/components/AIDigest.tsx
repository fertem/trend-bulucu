"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, DigestResponse, SystemFreshness } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export function AIDigest({ hasAi }: { hasAi: boolean }) {
  const { data: freshness } = useSWR<SystemFreshness>("/api/system/freshness", api.fetcher);
  const [data, setData] = useState<DigestResponse | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.digest();
      const now = new Date().toISOString();
      setData(r);
      setGeneratedAt(now);
      try { localStorage.setItem("digest-cache", JSON.stringify({ at: Date.now(), iso: now, data: r })); } catch {}
    } catch (e: any) {
      setError(e.message || "AI cevabı alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("digest-cache");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.data && Date.now() - parsed.at < 1000 * 60 * 60 * 12) {
          setData(parsed.data);
          setGeneratedAt(parsed.iso || new Date(parsed.at).toISOString());
        }
      }
    } catch {}
  }, []);

  if (!hasAi) return null;

  return (
    <div className="card card-pad mb-6 border-brand-100 bg-gradient-to-br from-brand-50/60 to-white">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs font-medium text-brand-700 uppercase tracking-wide">AI Haftalık Özet</div>
          <h2 className="text-lg font-semibold text-ink-900 mt-1">
            {data?.headline || "Bu haftanın trendleri tek bir bakışta"}
          </h2>
          <div className="text-xs text-ink-500 mt-0.5">
            {generatedAt ? `AI özeti: ${relativeTime(generatedAt)}` : "AI özeti henüz üretilmedi"}
            {freshness?.trends_last_collected && (
              <span> · trend verisi: {relativeTime(freshness.trends_last_collected)}</span>
            )}
            {freshness?.gsc_last_synced && (
              <span> · SC: {relativeTime(freshness.gsc_last_synced)}</span>
            )}
          </div>
        </div>
        <button className="btn-ghost text-xs whitespace-nowrap" onClick={generate} disabled={loading}>
          {loading ? "Hazırlanıyor…" : data ? "Yenile" : "Üret"}
        </button>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

      {!data && !loading && !error && (
        <p className="text-sm text-ink-500">
          AI tüm haftalık veriyi okuyup öne çıkanları, somut aksiyonları ve dikkat etmeniz gerekenleri çıkarır.
          "Üret" butonuna basın.
        </p>
      )}

      {data && (data.highlights?.length > 0 || data.actions?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {data.highlights?.length > 0 && (
            <div>
              <div className="label mb-2">Öne Çıkanlar</div>
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
              <div className="label mb-2">Bu Hafta Yap</div>
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
          <div className="label mb-1">Dikkat / Fırsat</div>
          <p className="text-sm text-ink-700">{data.watch_out}</p>
        </div>
      )}
    </div>
  );
}
