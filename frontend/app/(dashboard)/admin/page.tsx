"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, RunItem } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { KeywordSuggester } from "@/components/KeywordSuggester";
import { LongTailDiscovery } from "@/components/LongTailDiscovery";

export default function AdminPage() {
  const [hasAi, setHasAi] = useState(false);
  useEffect(() => {
    api.publicConfig().then((c) => setHasAi(c.has_ai)).catch(() => {});
  }, []);

  const { data: runs, mutate } = useSWR<RunItem[]>("/api/admin/runs", api.fetcher);
  const { data: adsStatus } = useSWR<{ configured: boolean }>("/api/admin/ads-status", api.fetcher);
  const { data: histStatus, mutate: mutateHist } = useSWR<{ has_data: boolean }>("/api/seasonality/status", api.fetcher);
  const [busy, setBusy] = useState<"collect" | "score" | "volumes" | "historical" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const triggerCollect = async () => {
    setBusy("collect");
    setMsg(null);
    try {
      const r = await api.triggerCollect();
      setMsg(r.message);
      setTimeout(() => mutate(), 2000);
    } catch (e: any) {
      setMsg(`Hata: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const recompute = async () => {
    setBusy("score");
    setMsg(null);
    try {
      const r = await api.recomputeScores();
      setMsg(`${r.recomputed} kelime için skor güncellendi.`);
    } catch (e: any) {
      setMsg(`Hata: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const collectHistorical = async () => {
    setBusy("historical");
    setMsg(null);
    try {
      const r = await api.collectHistorical();
      setMsg(r.message);
      setTimeout(() => mutateHist(), 60_000);
    } catch (e: any) {
      setMsg(`Hata: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const refreshVolumes = async (force = false) => {
    setBusy("volumes");
    setMsg(null);
    try {
      const r = await api.refreshVolumes(force);
      if (r.status === "ok") {
        setMsg(`Google Ads: ${r.updated} kelime için hacim güncellendi.`);
      } else if (r.status === "fresh") {
        setMsg("Tüm hacim verisi zaten güncel (<7 gün). 'Zorla' diyerek yine çekebilirsin.");
      } else if (r.status === "disabled") {
        setMsg("Google Ads .env'de yapılandırılmamış.");
      } else if (r.status === "error") {
        setMsg(`Hata: ${r.error}`);
      }
    } catch (e: any) {
      setMsg(`Hata: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("tr-TR") : "—");

  return (
    <div>
      <PageHeader
        title="Yönetim"
        subtitle="Manuel veri toplama, akıllı kelime önerileri ve sistem durumu."
      />

      <KeywordSuggester hasAi={hasAi} />

      <LongTailDiscovery hasAi={hasAi} />

      <div className="card card-pad mb-6">
        <div className="flex items-start justify-between mb-3">
          <h2 className="font-medium text-ink-900">İşlemler</h2>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`badge ${
                adsStatus?.configured ? "badge-up" : "badge-down"
              }`}
            >
              Google Ads: {adsStatus?.configured ? "bağlı" : "kapalı"}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary" onClick={triggerCollect} disabled={busy !== null}>
            {busy === "collect" ? "Başlatılıyor…" : "Şimdi Topla"}
          </button>
          <button className="btn-ghost" onClick={recompute} disabled={busy !== null}>
            {busy === "score" ? "Hesaplanıyor…" : "Skorları Yeniden Hesapla"}
          </button>
          {adsStatus?.configured && (
            <>
              <button className="btn-ghost" onClick={() => refreshVolumes(false)} disabled={busy !== null}>
                {busy === "volumes" ? "Güncelleniyor…" : "Hacmi Güncelle"}
              </button>
              <button className="btn-ghost text-xs" onClick={() => refreshVolumes(true)} disabled={busy !== null}>
                Zorla (cache'i atla)
              </button>
            </>
          )}
          <button className="btn-ghost" onClick={collectHistorical} disabled={busy !== null}>
            {busy === "historical"
              ? "Başlatılıyor…"
              : histStatus?.has_data
                ? "5 Yıllık Veriyi Tazele"
                : "5 Yıllık Veriyi Çek"}
          </button>
        </div>
        {msg && <div className="text-sm text-ink-700 mt-3">{msg}</div>}
        <p className="text-xs text-ink-500 mt-4">
          Toplama Pytrends üzerinden yapılır ve birkaç dakika sürer. Hacim verisi Google Ads Keyword Planner'dan
          gelir ve 7 gün cache'lenir.
        </p>
      </div>

      <section className="card card-pad">
        <h2 className="font-medium text-ink-900 mb-3">Son Toplama Çalışmaları</h2>
        {!runs || runs.length === 0 ? (
          <div className="text-sm text-ink-500">Henüz çalışma yok.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500">
                  <th className="font-medium py-2 pr-4">Başlangıç</th>
                  <th className="font-medium py-2 pr-4">Bitiş</th>
                  <th className="font-medium py-2 pr-4 text-right">Denenen</th>
                  <th className="font-medium py-2 pr-4 text-right">Başarılı</th>
                  <th className="font-medium py-2 pr-4 text-right">Hatalı</th>
                  <th className="font-medium py-2 pr-4">Durum</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-ink-100">
                    <td className="py-2 pr-4">{fmt(r.started_at)}</td>
                    <td className="py-2 pr-4 text-ink-500">{fmt(r.finished_at)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.attempted}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-emerald-700">{r.succeeded}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-red-600">{r.failed}</td>
                    <td className="py-2 pr-4">
                      <span className={`badge ${
                        r.status === "success" ? "badge-up" :
                        r.status === "failed" ? "badge-hot" : "badge-down"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
