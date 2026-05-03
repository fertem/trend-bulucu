"use client";

import { useState } from "react";
import { api, LongTailVariant } from "@/lib/api";

const TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  soru: { label: "Soru", cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  yaş: { label: "Yaş", cls: "bg-blue-50 text-blue-700 border-blue-100" },
  karşılaştırma: { label: "Karşılaştırma", cls: "bg-purple-50 text-purple-700 border-purple-100" },
  yıl: { label: "Yıl", cls: "bg-amber-50 text-amber-700 border-amber-100" },
  modifier: { label: "Modifier", cls: "bg-pink-50 text-pink-700 border-pink-100" },
  diğer: { label: "Diğer", cls: "bg-ink-100 text-ink-500 border-ink-200" },
};

export function LongTailDiscovery({ hasAi }: { hasAi: boolean }) {
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
        Long-tail keşfi için AI gerekli (.env'de OPENAI_API_KEY veya ANTHROPIC_API_KEY).
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
    setAdding(true);
    setMsg(null);
    try {
      const r = await api.addKeywords([...selected]);
      setMsg(`${r.added.length} kelime takip listesine eklendi.`);
      setItems((prev) => prev?.filter((v) => !r.added.includes(v.keyword)) ?? null);
      setSelected(new Set());
    } catch (e: any) {
      setMsg(`Hata: ${e.message}`);
    } finally {
      setAdding(false);
    }
  };

  const grouped: Record<string, LongTailVariant[]> = {};
  items?.forEach((v) => {
    const t = v.type || "diğer";
    grouped[t] = grouped[t] || [];
    grouped[t].push(v);
  });

  return (
    <section className="card card-pad mb-6 border-emerald-100 bg-gradient-to-br from-emerald-50/40 to-white">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-xs font-medium text-emerald-700 uppercase tracking-wide">AI Long-tail Keşfi</div>
          <h2 className="font-semibold text-ink-900 mt-1">Bir tohum kelimeden 15+ varyant üret</h2>
          <p className="text-xs text-ink-500 mt-1">
            Soru / yaş / karşılaştırma / yıl / modifier kategorilerinde uzun-kuyruk varyantlar.
          </p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); generate(); }} className="flex gap-2 mb-3">
        <input
          className="input flex-1"
          placeholder="Tohum kelime — örn. scratch, çocuk kodlama, yapay zeka"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
        />
        <button className="btn-primary" disabled={loading || !seed.trim()}>
          {loading ? "Üretiyor…" : "Üret"}
        </button>
      </form>

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      {msg && <div className="text-sm text-emerald-700 mb-2">{msg}</div>}

      {items && items.length > 0 && (
        <>
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm text-ink-700">{items.length} varyant — eklemek istediklerini seç:</div>
            {selected.size > 0 && (
              <button className="btn-primary text-xs" onClick={addSelected} disabled={adding}>
                {adding ? "Ekleniyor…" : `Seçilenleri ekle (${selected.size})`}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {Object.entries(grouped).map(([type, variants]) => (
              <div key={type}>
                <div className="label mb-1.5">
                  <span className={`badge border ${TYPE_LABELS[type]?.cls || TYPE_LABELS.diğer.cls}`}>
                    {TYPE_LABELS[type]?.label || type}
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
