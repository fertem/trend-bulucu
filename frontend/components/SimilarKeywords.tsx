"use client";

import { useState } from "react";
import Link from "next/link";
import { api, CorrelatedKeyword, SimilarKeyword } from "@/lib/api";

const TYPE_COLORS: Record<string, string> = {
  "eş anlamlı": "bg-blue-50 text-blue-700 border-blue-100",
  "yan kavram": "bg-purple-50 text-purple-700 border-purple-100",
  "soru formu": "bg-emerald-50 text-emerald-700 border-emerald-100",
  "uzun varyant": "bg-amber-50 text-amber-700 border-amber-100",
  "farklı dil": "bg-pink-50 text-pink-700 border-pink-100",
  default: "bg-ink-100 text-ink-700 border-ink-200",
};

export function SimilarKeywords({ keyword, hasAi, correlated }: {
  keyword: string;
  hasAi: boolean;
  correlated?: CorrelatedKeyword[];
}) {
  const [items, setItems] = useState<SimilarKeyword[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.similarKeywords(keyword);
      setItems(r.similar_keywords);
    } catch (e: any) {
      setError(e.message || "AI cevabı alınamadı");
    } finally {
      setLoading(false);
    }
  };

  const research = async (kw: string, addToTrack = false) => {
    setAdding(kw);
    try {
      await api.researchKeyword(kw, addToTrack);
      // Move to keyword in URL
      window.location.href = `/explorer?q=${encodeURIComponent(kw)}`;
    } catch (e: any) {
      alert(`Hata: ${e.message}`);
      setAdding(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* AI Similar */}
      {hasAi && (
        <div className="card card-pad bg-gradient-to-br from-purple-50/40 to-white border-purple-100">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs font-medium text-purple-700 uppercase tracking-wide">AI · Benzer Kelimeler</div>
              <h3 className="font-medium text-ink-900 mt-1">Bu kelimeye yakın aramalar</h3>
            </div>
            <button className="btn-ghost text-xs" onClick={generate} disabled={loading}>
              {loading ? "Düşünüyor…" : items ? "Yenile" : "Üret"}
            </button>
          </div>

          {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
          {!items && !loading && !error && (
            <p className="text-sm text-ink-500">10 semantik benzer kelime üretir, tek tıkla araştırabilirsin.</p>
          )}

          {items && items.length > 0 && (
            <div className="space-y-2">
              {items.map((s, i) => (
                <div key={i} className="p-2.5 rounded-md border border-ink-200 bg-white hover:border-purple-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink-900 text-sm">{s.keyword}</div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`badge border text-xs ${TYPE_COLORS[s.similarity_type] || TYPE_COLORS.default}`}>
                          {s.similarity_type}
                        </span>
                        <span className="text-xs text-ink-500 truncate">{s.reason}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        className="text-xs px-2 py-1 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                        onClick={() => research(s.keyword, false)}
                        disabled={adding === s.keyword}
                        title="5y veri çek + analiz"
                      >
                        {adding === s.keyword ? "..." : "Araştır"}
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded border border-ink-200 hover:bg-ink-50 disabled:opacity-50"
                        onClick={() => research(s.keyword, true)}
                        disabled={adding === s.keyword}
                        title="Takibe al + araştır"
                      >
                        + Takip
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pattern Correlation */}
      {correlated && correlated.length > 0 && (
        <div className="card card-pad bg-gradient-to-br from-cyan-50/40 to-white border-cyan-100">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs font-medium text-cyan-700 uppercase tracking-wide">Patern Eşleşmesi</div>
              <h3 className="font-medium text-ink-900 mt-1">Aynı trend şeklini gösterenler</h3>
              <p className="text-xs text-ink-500 mt-1">Pearson korelasyonu — birlikte hareket eden takipteki kelimeler.</p>
            </div>
          </div>

          <div className="space-y-2">
            {correlated.map((c, i) => {
              const pct = Math.round(Math.abs(c.correlation) * 100);
              const positive = c.correlation > 0;
              return (
                <Link
                  key={i}
                  href={`/explorer?q=${encodeURIComponent(c.keyword)}`}
                  className="flex items-center justify-between p-2.5 rounded-md border border-ink-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink-900 text-sm truncate">{c.keyword}</div>
                    {c.category && <span className="badge badge-cat mt-0.5">{c.category}</span>}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className={`text-sm font-medium tabular-nums ${
                      positive ? "text-emerald-700" : "text-red-600"
                    }`}>
                      {positive ? "↗" : "↘"} {pct}%
                    </div>
                    <div className="text-[10px] text-ink-500">
                      {positive ? "birlikte yükselir" : "ters hareket"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {(!correlated || correlated.length === 0) && !hasAi && (
        <div className="card card-pad text-sm text-ink-500">
          Yeterli takip verisi yok (en az 7 gün) veya AI yapılandırılmamış.
        </div>
      )}
    </div>
  );
}
