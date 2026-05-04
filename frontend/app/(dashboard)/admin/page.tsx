"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, RunItem } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { KeywordSuggester } from "@/components/KeywordSuggester";
import { LongTailDiscovery } from "@/components/LongTailDiscovery";
import { useT, useLang } from "@/lib/i18n";

export default function AdminPage() {
  const t = useT();
  const { lang } = useLang();
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
      setMsg(`${t.common.error}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const recompute = async () => {
    setBusy("score");
    setMsg(null);
    try {
      const r = await api.recomputeScores();
      setMsg(t.admin.msgRecomputed(r.recomputed));
    } catch (e: any) {
      setMsg(`${t.common.error}: ${e.message}`);
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
      setMsg(`${t.common.error}: ${e.message}`);
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
        setMsg(t.admin.msgVolumes(r.updated ?? 0));
      } else if (r.status === "fresh") {
        setMsg(t.admin.msgFresh);
      } else if (r.status === "disabled") {
        setMsg(t.admin.msgAdsDisabled);
      } else if (r.status === "error") {
        setMsg(`${t.common.error}: ${r.error}`);
      }
    } catch (e: any) {
      setMsg(`${t.common.error}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString(lang === "en" ? "en-US" : "tr-TR") : "—");

  return (
    <div>
      <PageHeader
        title={t.admin.title}
        subtitle={t.admin.subtitle}
      />

      <KeywordSuggester hasAi={hasAi} />

      <LongTailDiscovery hasAi={hasAi} />

      <div className="card card-pad mb-6">
        <div className="flex items-start justify-between mb-3">
          <h2 className="font-medium text-ink-900">{t.admin.operations}</h2>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`badge ${
                adsStatus?.configured ? "badge-up" : "badge-down"
              }`}
            >
              Google Ads: {adsStatus?.configured ? t.admin.adsConnected : t.admin.adsClosed}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary" onClick={triggerCollect} disabled={busy !== null}>
            {busy === "collect" ? t.admin.starting : t.admin.collectNow}
          </button>
          <button className="btn-ghost" onClick={recompute} disabled={busy !== null}>
            {busy === "score" ? t.admin.computing : t.admin.recomputeScores}
          </button>
          {adsStatus?.configured && (
            <>
              <button className="btn-ghost" onClick={() => refreshVolumes(false)} disabled={busy !== null}>
                {busy === "volumes" ? t.admin.updating : t.admin.refreshVolumes}
              </button>
              <button className="btn-ghost text-xs" onClick={() => refreshVolumes(true)} disabled={busy !== null}>
                {t.admin.forceVolumes}
              </button>
            </>
          )}
          <button className="btn-ghost" onClick={collectHistorical} disabled={busy !== null}>
            {busy === "historical"
              ? t.admin.starting
              : histStatus?.has_data
                ? t.admin.fetchHistoricalRefresh
                : t.admin.fetchHistoricalNew}
          </button>
        </div>
        {msg && <div className="text-sm text-ink-700 mt-3">{msg}</div>}
        <p className="text-xs text-ink-500 mt-4">{t.admin.operationsHint}</p>
      </div>

      <section className="card card-pad">
        <h2 className="font-medium text-ink-900 mb-3">{t.admin.recentRuns}</h2>
        {!runs || runs.length === 0 ? (
          <div className="text-sm text-ink-500">{t.admin.noRuns}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500">
                  <th className="font-medium py-2 pr-4">{t.admin.th.start}</th>
                  <th className="font-medium py-2 pr-4">{t.admin.th.end}</th>
                  <th className="font-medium py-2 pr-4 text-right">{t.admin.th.attempted}</th>
                  <th className="font-medium py-2 pr-4 text-right">{t.admin.th.succeeded}</th>
                  <th className="font-medium py-2 pr-4 text-right">{t.admin.th.failed}</th>
                  <th className="font-medium py-2 pr-4">{t.admin.th.status}</th>
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
