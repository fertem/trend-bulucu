"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ResearchResponse } from "@/lib/api";
import { SeasonalityPanel } from "./SeasonalityPanel";

export function UntrackedKeywordPrompt({ keyword }: { keyword: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"research" | "track" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResearchResponse | null>(null);

  const research = async (addToTracking = false) => {
    setBusy(addToTracking ? "track" : "research");
    setError(null);
    try {
      const r = await api.researchKeyword(keyword, addToTracking);
      setData(r);
      if (addToTracking) {
        // refresh the page to load tracked-keyword view properly
        setTimeout(() => router.refresh(), 1000);
      }
    } catch (e: any) {
      setError(e.message || "Veri çekilemedi");
    } finally {
      setBusy(null);
    }
  };

  if (data) {
    // Render seasonality panel (it will fetch from cache via the existing endpoints)
    return (
      <div className="space-y-4">
        <div className="card card-pad bg-emerald-50/40 border-emerald-100">
          <div className="text-sm text-emerald-700">
            ✓ <strong>"{keyword}"</strong> için 5 yıllık veri çekildi.
            {data.tracking ? " Takip listesine de eklendi." : ""}
          </div>
          {!data.tracking && (
            <button className="btn-ghost text-xs mt-3" onClick={() => research(true)} disabled={busy !== null}>
              {busy === "track" ? "Ekleniyor…" : "Takip listesine de ekle (günlük güncelleme)"}
            </button>
          )}
        </div>
        <SeasonalityPanel keyword={keyword} />
      </div>
    );
  }

  return (
    <div className="card card-pad border-dashed bg-ink-50/30">
      <div className="text-sm text-ink-500 mb-1">"{keyword}" şu an takip edilmiyor.</div>
      <p className="text-sm text-ink-700 mb-4">
        Bu kelime için <strong>5 yıllık tarihsel veri</strong> çekebilirim. Pytrends üzerinden tek seferde
        haftalık veri gelir, ~5-10 saniye sürer. Sonra mevsimsellik analizini görebilirsin.
      </p>

      {error && <div className="text-sm text-red-600 mb-3">Hata: {error}</div>}

      <div className="flex gap-2 flex-wrap">
        <button className="btn-primary" onClick={() => research(false)} disabled={busy !== null}>
          {busy === "research" ? "Çekiliyor…" : "5 yıllık veriyi çek + analiz et"}
        </button>
        <button className="btn-ghost" onClick={() => research(true)} disabled={busy !== null}>
          {busy === "track" ? "Ekleniyor…" : "Çek + takip listesine ekle"}
        </button>
      </div>
      <p className="text-xs text-ink-500 mt-3">
        "Takip listesine ekle" derseniz bu kelime artık her gün otomatik güncellenir, AI özetlerine ve uyarılara dahil olur.
      </p>
    </div>
  );
}
