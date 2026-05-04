"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ResearchResponse } from "@/lib/api";
import { SeasonalityPanel } from "./SeasonalityPanel";
import { useT } from "@/lib/i18n";

export function UntrackedKeywordPrompt({ keyword }: { keyword: string }) {
  const t = useT();
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
        setTimeout(() => router.refresh(), 1000);
      }
    } catch (e: any) {
      setError(e.message || t.untracked.fetchFail);
    } finally {
      setBusy(null);
    }
  };

  if (data) {
    return (
      <div className="space-y-4">
        <div className="card card-pad bg-emerald-50/40 border-emerald-100">
          <div className="text-sm text-emerald-700">
            {t.untracked.success(keyword)}
            {data.tracking ? t.untracked.alsoTracked : ""}
          </div>
          {!data.tracking && (
            <button className="btn-ghost text-xs mt-3" onClick={() => research(true)} disabled={busy !== null}>
              {busy === "track" ? t.untracked.adding : t.untracked.addToTrack}
            </button>
          )}
        </div>
        <SeasonalityPanel keyword={keyword} />
      </div>
    );
  }

  return (
    <div className="card card-pad border-dashed bg-ink-50/30">
      <div className="text-sm text-ink-500 mb-1">{t.untracked.notTracking(keyword)}</div>
      <p className="text-sm text-ink-700 mb-4">{t.untracked.intro}</p>

      {error && <div className="text-sm text-red-600 mb-3">{t.common.error}: {error}</div>}

      <div className="flex gap-2 flex-wrap">
        <button className="btn-primary" onClick={() => research(false)} disabled={busy !== null}>
          {busy === "research" ? t.untracked.fetching : t.untracked.fetchAndAnalyze}
        </button>
        <button className="btn-ghost" onClick={() => research(true)} disabled={busy !== null}>
          {busy === "track" ? t.untracked.adding : t.untracked.fetchAndTrack}
        </button>
      </div>
      <p className="text-xs text-ink-500 mt-3">{t.untracked.trackingHint}</p>
    </div>
  );
}
