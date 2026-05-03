"use client";

import { useState } from "react";
import { api, KDResult, PAAQuestion } from "@/lib/api";

const INTENT_COLORS: Record<string, string> = {
  informational: "bg-blue-50 text-blue-700 border-blue-100",
  commercial: "bg-purple-50 text-purple-700 border-purple-100",
  transactional: "bg-emerald-50 text-emerald-700 border-emerald-100",
  navigational: "bg-amber-50 text-amber-700 border-amber-100",
};

const INTENT_LABELS: Record<string, string> = {
  informational: "Bilgi",
  commercial: "Karşılaştırma",
  transactional: "Satın alma",
  navigational: "Marka",
};

export function KeywordIntelligence({ keyword, category }: { keyword: string; category?: string | null }) {
  const [intent, setIntent] = useState<{ intent: string; confidence: number; reasoning: string } | null>(null);
  const [kd, setKd] = useState<KDResult | null>(null);
  const [paa, setPaa] = useState<{ questions: PAAQuestion[]; topic_clusters: string[] } | null>(null);
  const [busy, setBusy] = useState<"intent" | "kd" | "paa" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getIntent = async () => {
    setBusy("intent");
    setError(null);
    try {
      const r = await api.aiSearchIntent([keyword]);
      if (r.items[0]) {
        setIntent({
          intent: r.items[0].intent,
          confidence: r.items[0].confidence,
          reasoning: r.items[0].reasoning,
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const getKD = async () => {
    setBusy("kd");
    setError(null);
    try {
      const r = await api.aiKeywordDifficulty(keyword, category || undefined);
      setKd(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const getPAA = async () => {
    setBusy("paa");
    setError(null);
    try {
      const r = await api.aiPAA(keyword);
      setPaa(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card card-pad bg-gradient-to-br from-purple-50/30 to-white border-purple-100">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-xs font-medium text-purple-700 uppercase tracking-wide">Keyword Intelligence</div>
          <h3 className="font-semibold text-ink-900 mt-1">AI Analiz</h3>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!intent && <button className="btn-ghost text-xs" onClick={getIntent} disabled={busy !== null}>
            {busy === "intent" ? "..." : "🎯 Intent"}
          </button>}
          {!kd && <button className="btn-ghost text-xs" onClick={getKD} disabled={busy !== null}>
            {busy === "kd" ? "..." : "📊 Zorluk (KD)"}
          </button>}
          {!paa && <button className="btn-ghost text-xs" onClick={getPAA} disabled={busy !== null}>
            {busy === "paa" ? "..." : "❓ PAA Soruları"}
          </button>}
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* INTENT */}
        {intent && (
          <div className="card card-pad bg-white">
            <div className="label mb-1">Search Intent</div>
            <span className={`badge border ${INTENT_COLORS[intent.intent] || INTENT_COLORS.informational}`}>
              {INTENT_LABELS[intent.intent] || intent.intent}
            </span>
            <div className="text-xs text-ink-500 mt-2">
              Güven: %{Math.round(intent.confidence * 100)}
            </div>
            <p className="text-xs text-ink-700 mt-1">{intent.reasoning}</p>
          </div>
        )}

        {/* KD */}
        {kd && (
          <div className="card card-pad bg-white">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="label">Keyword Difficulty</div>
                <div className={`text-2xl font-semibold tabular-nums ${
                  kd.kd_score < 30 ? "text-emerald-700" :
                  kd.kd_score < 60 ? "text-amber-700" : "text-red-600"
                }`}>
                  {kd.kd_score}<span className="text-sm text-ink-500">/100</span>
                </div>
                <div className="text-xs text-ink-500 capitalize">{kd.verdict}</div>
              </div>
            </div>
            <div className="space-y-1 text-xs text-ink-700">
              <div><strong>Rekabet:</strong> {kd.competition_type}</div>
              <div><strong>Süre:</strong> {kd.estimated_time_to_rank}</div>
              {kd.winning_strategy && (
                <div className="mt-2 p-2 bg-brand-50/40 rounded">
                  💡 {kd.winning_strategy}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PAA */}
      {paa && paa.questions.length > 0 && (
        <div className="mt-4">
          <div className="label mb-2">İnsanlar Şunu Da Soruyor ({paa.questions.length})</div>
          {paa.topic_clusters.length > 0 && (
            <div className="text-xs text-ink-500 mb-2">
              Ana temalar: {paa.topic_clusters.join(" · ")}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
            {paa.questions.map((q, i) => (
              <div key={i} className="card card-pad bg-white text-sm">
                <div className="font-medium text-ink-900">{q.question}</div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="badge badge-cat">{q.type}</span>
                  <span className={`badge border ${INTENT_COLORS[q.search_intent] || INTENT_COLORS.informational}`}>
                    {INTENT_LABELS[q.search_intent] || q.search_intent}
                  </span>
                </div>
                {q.content_angle && (
                  <p className="text-xs text-ink-500 mt-1 italic">"{q.content_angle}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
