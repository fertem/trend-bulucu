"use client";

import { useState } from "react";
import { api } from "@/lib/api";

type DeepAnalysis = {
  executive_summary: string;
  historical_pattern: string;
  current_state: string;
  next_3_months: string;
  recommendations: { action: string; timing: string; channel: string }[];
  risk_or_opportunity: string;
};

type ContentBrief = {
  title_options: string[];
  target_audience: string;
  search_intent: string;
  outline: { h2: string; h3: string[]; talking_points: string }[];
  key_takeaways: string[];
  social_hooks: { instagram: string; reels: string };
  secondary_keywords: string[];
};

export function AIDeepAnalysis({ keyword }: { keyword: string }) {
  const [tab, setTab] = useState<"deep" | "brief">("deep");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deep, setDeep] = useState<DeepAnalysis | null>(null);
  const [brief, setBrief] = useState<ContentBrief | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      if (tab === "deep") {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/ai/deep-analysis`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("trend-bulucu-token")}` },
          body: JSON.stringify({ keyword }),
        }).then((r) => { if (!r.ok) throw new Error("API hatası"); return r.json(); });
        setDeep(r);
      } else {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/ai/content-brief`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("trend-bulucu-token")}` },
          body: JSON.stringify({ keyword }),
        }).then((r) => { if (!r.ok) throw new Error("API hatası"); return r.json(); });
        setBrief(r);
      }
    } catch (e: any) {
      setError(e.message || "AI cevabı alınamadı");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad bg-gradient-to-br from-brand-50/40 to-white border-brand-100">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-xs font-medium text-brand-700 uppercase tracking-wide">AI Derin Analiz</div>
          <h3 className="font-semibold text-ink-900 mt-1">"{keyword}"</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-ink-200 bg-white p-0.5 text-xs">
            <button
              onClick={() => setTab("deep")}
              className={`px-3 py-1 rounded ${tab === "deep" ? "bg-brand-600 text-white" : "text-ink-700 hover:bg-ink-50"}`}
            >
              Derin Analiz
            </button>
            <button
              onClick={() => setTab("brief")}
              className={`px-3 py-1 rounded ${tab === "brief" ? "bg-brand-600 text-white" : "text-ink-700 hover:bg-ink-50"}`}
            >
              İçerik Brief'i
            </button>
          </div>
          <button className="btn-primary text-xs" onClick={generate} disabled={busy}>
            {busy ? "Hazırlıyor…" : "Üret"}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      {tab === "deep" && (
        <>
          {!deep && !busy && !error && (
            <p className="text-sm text-ink-500">5 yıllık veri + son hareket + mevsimsellik üzerinden tek tıkla 5 bölümlü rapor üret.</p>
          )}
          {deep && (
            <div className="space-y-4 text-sm">
              <div className="font-medium text-ink-900 text-base border-l-4 border-brand-600 pl-3 py-1">
                {deep.executive_summary}
              </div>
              <Section label="Tarihsel Patern" body={deep.historical_pattern} />
              <Section label="Şu Anki Durum" body={deep.current_state} />
              <Section label="Önümüzdeki 3 Ay" body={deep.next_3_months} />
              {deep.recommendations && deep.recommendations.length > 0 && (
                <div>
                  <div className="label mb-2">Önerilen Aksiyonlar</div>
                  <div className="space-y-2">
                    {deep.recommendations.map((r, i) => (
                      <div key={i} className="border-l-2 border-brand-200 pl-3">
                        <div className="font-medium text-ink-900">→ {r.action}</div>
                        <div className="text-xs text-ink-500 mt-0.5">
                          <span className="badge badge-up mr-1">{r.channel}</span>
                          <span>{r.timing}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {deep.risk_or_opportunity && (
                <div className="p-3 rounded-md bg-amber-50 border border-amber-100 text-sm">
                  <div className="label mb-1">Risk / Fırsat</div>
                  <div className="text-ink-700">{deep.risk_or_opportunity}</div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "brief" && (
        <>
          {!brief && !busy && !error && (
            <p className="text-sm text-ink-500">Bu kelime üzerine blog yazısı + Instagram + Reels için tam çekirdek brief.</p>
          )}
          {brief && (
            <div className="space-y-4 text-sm">
              {brief.title_options && brief.title_options.length > 0 && (
                <div>
                  <div className="label mb-2">Başlık Önerileri</div>
                  <ul className="space-y-1">
                    {brief.title_options.map((t, i) => (
                      <li key={i} className="text-ink-900">• {t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {brief.target_audience && (
                <Section label="Hedef Kitle" body={brief.target_audience} />
              )}
              {brief.search_intent && (
                <Section label="Arama Niyeti" body={brief.search_intent} />
              )}
              {brief.outline && brief.outline.length > 0 && (
                <div>
                  <div className="label mb-2">Outline</div>
                  <div className="space-y-3">
                    {brief.outline.map((o, i) => (
                      <div key={i} className="border-l-2 border-brand-200 pl-3">
                        <div className="font-medium text-ink-900">H2: {o.h2}</div>
                        {o.h3 && o.h3.length > 0 && (
                          <ul className="text-xs text-ink-700 mt-1 space-y-0.5">
                            {o.h3.map((h, j) => (
                              <li key={j}>↳ H3: {h}</li>
                            ))}
                          </ul>
                        )}
                        {o.talking_points && (
                          <div className="text-xs text-ink-500 mt-1">{o.talking_points}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {brief.key_takeaways && brief.key_takeaways.length > 0 && (
                <div>
                  <div className="label mb-2">Okuyucu Çıkarımları</div>
                  <ul className="space-y-1 text-ink-700">
                    {brief.key_takeaways.map((t, i) => (
                      <li key={i}>✓ {t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {brief.social_hooks && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {brief.social_hooks.instagram && (
                    <div className="p-3 rounded-md bg-pink-50 border border-pink-100">
                      <div className="label mb-1">Instagram</div>
                      <div className="text-ink-700">{brief.social_hooks.instagram}</div>
                    </div>
                  )}
                  {brief.social_hooks.reels && (
                    <div className="p-3 rounded-md bg-purple-50 border border-purple-100">
                      <div className="label mb-1">Reels / Shorts</div>
                      <div className="text-ink-700">{brief.social_hooks.reels}</div>
                    </div>
                  )}
                </div>
              )}
              {brief.secondary_keywords && brief.secondary_keywords.length > 0 && (
                <div>
                  <div className="label mb-2">Yan SEO Kelimeleri</div>
                  <div className="flex flex-wrap gap-1.5">
                    {brief.secondary_keywords.map((k, i) => (
                      <span key={i} className="badge badge-cat">{k}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Section({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <p className="text-ink-700">{body}</p>
    </div>
  );
}
