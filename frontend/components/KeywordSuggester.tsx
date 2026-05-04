"use client";

import { useState } from "react";
import { api, KeywordSuggestion } from "@/lib/api";
import { useT } from "@/lib/i18n";

export function KeywordSuggester({ hasAi, onAdded }: { hasAi: boolean; onAdded?: () => void }) {
  const t = useT();
  const [items, setItems] = useState<KeywordSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!hasAi) {
    return (
      <div className="card card-pad mb-6 text-sm text-ink-500">
        {t.keywordSuggester.aiKeyRequired}
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
      setError(e.message || t.keywordSuggester.error);
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
      setMsg(t.keywordSuggester.addResult(r.added.length, r.skipped.length));
      setItems((prev) => prev.filter((s) => !r.added.includes(s.keyword)));
      setSelected(new Set());
      onAdded?.();
    } catch (e: any) {
      setError(e.message || t.keywordSuggester.addError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card card-pad mb-6 border-brand-100 bg-gradient-to-br from-brand-50/40 to-white">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs font-medium text-brand-700 uppercase tracking-wide">{t.keywordSuggester.overline}</div>
          <h2 className="font-semibold text-ink-900 mt-1">{t.keywordSuggester.title}</h2>
          <p className="text-xs text-ink-500 mt-1">{t.keywordSuggester.description}</p>
        </div>
        <div className="flex gap-2">
          {items.length > 0 && (
            <button className="btn-primary text-xs" onClick={addSelected} disabled={loading || selected.size === 0}>
              {t.keywordSuggester.addSelected(selected.size)}
            </button>
          )}
          <button className="btn-ghost text-xs" onClick={generate} disabled={loading}>
            {loading ? t.keywordSuggester.thinking : items.length > 0 ? t.keywordSuggester.suggestNew : t.keywordSuggester.suggest}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
      {msg && <div className="text-sm text-emerald-700 mb-3">{msg}</div>}

      {items.length === 0 && !loading && (
        <p className="text-sm text-ink-500">{t.keywordSuggester.intro}</p>
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
