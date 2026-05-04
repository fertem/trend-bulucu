"use client";

import { useState } from "react";
import { api, LongTailVariant } from "@/lib/api";
import { useT } from "@/lib/i18n";

const TYPE_CLS: Record<string, string> = {
  soru: "bg-emerald-50 text-emerald-700 border-emerald-100",
  yaş: "bg-blue-50 text-blue-700 border-blue-100",
  karşılaştırma: "bg-purple-50 text-purple-700 border-purple-100",
  yıl: "bg-amber-50 text-amber-700 border-amber-100",
  modifier: "bg-pink-50 text-pink-700 border-pink-100",
  diğer: "bg-ink-100 text-ink-500 border-ink-200",
};

export function LongTailDiscovery({ hasAi }: { hasAi: boolean }) {
  const t = useT();
  const [seed, setSeed] = useState("");
  const [items, setItems] = useState<LongTailVariant[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!hasAi) {
    return (
      <section className="card card-pad mb-6 text-sm text-ink-500">
        {t.longTail.aiKeyRequired}
      </section>
    );
  }

  const generate = async () => {
    if (!seed.trim()) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const r = await api.longTail(seed.trim());
      setItems(r.variants);
      setSelected(new Set());
    } catch (e: any) {
      setError(e.message || t.longTail.error);
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
    setAdding(true);
    setMsg(null);
    try {
      const r = await api.addKeywords([...selected]);
      setMsg(t.longTail.addResult(r.added.length));
      setItems((prev) => prev?.filter((v) => !r.added.includes(v.keyword)) ?? null);
      setSelected(new Set());
    } catch (e: any) {
      setMsg(`${t.common.error}: ${e.message}`);
    } finally {
      setAdding(false);
    }
  };

  const grouped: Record<string, LongTailVariant[]> = {};
  items?.forEach((v) => {
    const tp = v.type || "diğer";
    grouped[tp] = grouped[tp] || [];
    grouped[tp].push(v);
  });

  return (
    <section className="card card-pad mb-6 border-emerald-100 bg-gradient-to-br from-emerald-50/40 to-white">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-xs font-medium text-emerald-700 uppercase tracking-wide">{t.longTail.overline}</div>
          <h2 className="font-semibold text-ink-900 mt-1">{t.longTail.title}</h2>
          <p className="text-xs text-ink-500 mt-1">{t.longTail.description}</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); generate(); }} className="flex gap-2 mb-3">
        <input
          className="input flex-1"
          placeholder={t.longTail.seedPlaceholder}
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
        />
        <button className="btn-primary" disabled={loading || !seed.trim()}>
          {loading ? t.longTail.generating : t.longTail.generate}
        </button>
      </form>

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      {msg && <div className="text-sm text-emerald-700 mb-2">{msg}</div>}

      {items && items.length > 0 && (
        <>
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm text-ink-700">{t.longTail.selectHint(items.length)}</div>
            {selected.size > 0 && (
              <button className="btn-primary text-xs" onClick={addSelected} disabled={adding}>
                {adding ? t.longTail.adding : t.longTail.addSelected(selected.size)}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {Object.entries(grouped).map(([type, variants]) => (
              <div key={type}>
                <div className="label mb-1.5">
                  <span className={`badge border ${TYPE_CLS[type] || TYPE_CLS.diğer}`}>
                    {(t.longTail.types as Record<string, string>)[type] || type}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {variants.map((v) => {
                    const sel = selected.has(v.keyword);
                    return (
                      <button
                        key={v.keyword}
                        onClick={() => toggle(v.keyword)}
                        className={`text-xs px-2.5 py-1 rounded-md border transition ${
                          sel
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200 font-medium"
                            : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
                        }`}
                      >
                        {sel && "✓ "}{v.keyword}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
