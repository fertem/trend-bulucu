"use client";

import { useState } from "react";
import { api, DiscoveryItem } from "@/lib/api";

const ACTION_STYLES: Record<DiscoveryItem["suggested_action"], string> = {
  write: "bg-emerald-50 text-emerald-700 border-emerald-100",
  track: "bg-amber-50 text-amber-700 border-amber-100",
  skip: "bg-ink-100 text-ink-500 border-ink-200",
};

export function AIDiscovery({ hasAi }: { hasAi: boolean }) {
  const [items, setItems] = useState<DiscoveryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(10);
  const [adding, setAdding] = useState<Set<string>>(new Set());

  if (!hasAi) {
    return (
      <section className="card card-pad mb-6 text-sm text-ink-500">
        AI Keşif Hattı için OpenAI veya Anthropic API anahtarı gerekli (Ayarlar → API).
      </section>
    );
  }

  const run = async () => {
    setLoading(true);
    setError(null);
    setItems(null);
    try {
      const r = await api.aiDiscovery(count);
      setItems(r.items);
      if (r.message) setError(r.message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const trackKeyword = async (kw: string) => {
    setAdding((s) => new Set(s).add(kw));
    try {
      await api.addKeywords([kw]);
      setItems((prev) => prev?.map((i) => (i.keyword === kw ? { ...i, suggested_action: "skip", action_label: "✓ Eklendi" } : i)) ?? null);
    } catch (e: any) {
      alert(`Hata: ${e.message}`);
    } finally {
      setAdding((s) => { const n = new Set(s); n.delete(kw); return n; });
    }
  };

  return (
    <section className="card card-pad mb-6 border-purple-100 bg-gradient-to-br from-purple-50/40 to-white">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-xs font-medium text-purple-700 uppercase tracking-wide">
            AI Keşif Hattı
          </div>
          <h2 className="text-lg font-semibold text-ink-900 mt-1">
            🪄 Akıllı Anahtar Kelime Keşfi
          </h2>
          <p className="text-xs text-ink-500 mt-1">
            AI markaya özel kelimeler üretir → Pytrends'ten verisini çeker → mevcut sayfalarınla karşılaştırır → öncelik sıralı liste döner.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input text-sm py-1.5 px-2 w-20" value={count} onChange={(e) => setCount(parseInt(e.target.value))} disabled={loading}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
          </select>
          <button className="btn-primary text-sm" onClick={run} disabled={loading}>
            {loading ? "Keşfediyor…" : items ? "Yeniden Keşfet" : "🪄 Keşfi Başlat"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-ink-700">
          {count} kelime için AI üretiyor + Pytrends'ten 5 yıllık veri çekiyor + sitenle karşılaştırıyor...
          Bu işlem ~{Math.round(count * 5 / 60)}+ dakika sürebilir.
        </div>
      )}

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

      {items && items.length === 0 && (
        <div className="text-sm text-ink-500 py-4">Sonuç bulunamadı.</div>
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-500">
                <th className="font-medium py-2 pr-3">Kelime</th>
                <th className="font-medium py-2 pr-3 text-right">Trend</th>
                <th className="font-medium py-2 pr-3 text-right">Kapsam</th>
                <th className="font-medium py-2 pr-3 text-right">Öncelik</th>
                <th className="font-medium py-2 pr-3">Eylem</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.keyword} className="border-t border-ink-100 hover:bg-purple-50/30 align-top">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-ink-900">{it.keyword}</div>
                    <div className="text-xs text-ink-500 mt-0.5">
                      <span className="badge badge-cat mr-1.5">{it.type}</span>
                      {it.ai_reason}
                    </div>
                    {it.best_match_slug && (
                      <div className="text-[10px] text-ink-500 mt-1">
                        En yakın sayfan: <a href={it.best_match_url || "#"} target="_blank" rel="noreferrer" className="hover:underline">{it.best_match_slug}</a>
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {it.trend_annual_avg !== null ? (
                      <>
                        <div>{it.trend_annual_avg.toFixed(0)}</div>
                        {it.trend_lift_pct !== undefined && (
                          <div className={`text-[10px] ${it.trend_lift_pct > 0 ? "text-emerald-700" : "text-ink-500"}`}>
                            bu ay {it.trend_lift_pct > 0 ? "+" : ""}{it.trend_lift_pct.toFixed(0)}%
                          </div>
                        )}
                      </>
                    ) : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    <span className={it.coverage_score < 0.3 ? "text-red-600" : it.coverage_score < 0.6 ? "text-amber-700" : "text-emerald-700"}>
                      {Math.round(it.coverage_score * 100)}%
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-ink-900">
                    {it.priority.toFixed(0)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`badge border text-xs ${ACTION_STYLES[it.suggested_action]}`}>
                      {it.action_label}
                    </span>
                    <div className="flex gap-1 mt-1.5">
                      <a
                        href={`/explorer?q=${encodeURIComponent(it.keyword)}`}
                        className="text-[10px] px-2 py-0.5 rounded border border-ink-200 hover:bg-ink-50"
                      >
                        Detay
                      </a>
                      {it.suggested_action !== "skip" && (
                        <button
                          className="text-[10px] px-2 py-0.5 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                          onClick={() => trackKeyword(it.keyword)}
                          disabled={adding.has(it.keyword)}
                        >
                          + Takip
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items && items.length > 0 && (
        <p className="text-xs text-ink-500 mt-3">
          💡 <strong>Öncelik</strong> = trend hacmi × (1 − kapsama). <strong>Yazı yaz</strong> = sitende yok + trend yüksek.
          <strong>Takibe al</strong> = belki yazılır, izlemeli. <strong>Atla</strong> = ya zaten kapsanmış ya düşük trend.
        </p>
      )}
    </section>
  );
}
