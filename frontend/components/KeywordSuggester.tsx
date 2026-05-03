"use client";

import { useState } from "react";
import { api, KeywordSuggestion } from "@/lib/api";

export function KeywordSuggester({ hasAi, onAdded }: { hasAi: boolean; onAdded?: () => void }) {
  const [items, setItems] = useState<KeywordSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!hasAi) {
    return (
      <div className="card card-pad mb-6 text-sm text-ink-500">
        AI kelime önerileri için <code>backend/.env</code> dosyasına <code>OPENAI_API_KEY</code> veya <code>ANTHROPIC_API_KEY</code> ekleyin.
      </div>
    );
  }

  const generate = async () => {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const r = await api.suggestKeywords();
      setItems(r.suggestions);
      setSelected(new Set(r.suggestions.map((s) => s.keyword)));
    } catch (e: any) {
      setError(e.message || "AI cevabı alınamadı");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (kw: string) => {
    const next = new Set(selected);
    if (next.has(kw)) next.delete(kw);
    else next.add(kw);
    setSelected(next);
  };

  const addSelected = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const r = await api.addKeywords([...selected]);
      setMsg(`${r.added.length} kelime eklendi${r.skipped.length ? `, ${r.skipped.length} atlandı (zaten var)` : ""}.`);
      setItems((prev) => prev.filter((s) => !r.added.includes(s.keyword)));
      setSelected(new Set());
      onAdded?.();
    } catch (e: any) {
      setError(e.message || "Ekleme başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card card-pad mb-6 border-brand-100 bg-gradient-to-br from-brand-50/40 to-white">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs font-medium text-brand-700 uppercase tracking-wide">AI Akıllı Öneriler</div>
          <h2 className="font-semibold text-ink-900 mt-1">Yeni izlenecek kelimeler</h2>
          <p className="text-xs text-ink-500 mt-1">Mevcut yükselen aramalardan AI çıkarımı.</p>
        </div>
        <div className="flex gap-2">
          {items.length > 0 && (
            <button className="btn-primary text-xs" onClick={addSelected} disabled={loading || selected.size === 0}>
              Seçilenleri ekle ({selected.size})
            </button>
          )}
          <button className="btn-ghost text-xs" onClick={generate} disabled={loading}>
            {loading ? "Düşünüyor…" : items.length > 0 ? "Yeni öneri" : "Öneri al"}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
      {msg && <div className="text-sm text-emerald-700 mb-3">{msg}</div>}

      {items.length === 0 && !loading && (
        <p className="text-sm text-ink-500">"Öneri al" diyerek AI'dan 5 yeni kelime önerisi alın.</p>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((s) => (
            <label
              key={s.keyword}
              className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition ${
                selected.has(s.keyword) ? "border-brand-200 bg-brand-50/40" : "border-ink-200 bg-white"
              }`}
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.has(s.keyword)}
                onChange={() => toggle(s.keyword)}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-900 text-sm">{s.keyword}</span>
                  <span className="badge badge-cat">{s.category}</span>
                </div>
                <div className="text-xs text-ink-500 mt-1">{s.reason}</div>
              </div>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
