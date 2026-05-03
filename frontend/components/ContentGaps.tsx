"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, ContentGap, SystemFreshness } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { ArticleWriter } from "./ArticleWriter";

type StatusKey = "all" | "new" | "in_progress" | "addressed" | "dismissed";

const STATUS_LABELS: Record<StatusKey, string> = {
  all: "Tümü",
  new: "Yeni",
  in_progress: "İşleniyor",
  addressed: "Yazıldı",
  dismissed: "İptal",
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { month: "short", day: "numeric" });
}

function daysSince(iso?: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export function ContentGapsCard() {
  const { data: status, mutate: mutateStatus } = useSWR<{
    configured: boolean;
    kod_org_path: string;
    content_count: number;
    last_scanned_at: string | null;
  }>("/api/content/status", api.fetcher);
  const { data: freshness } = useSWR<SystemFreshness>("/api/system/freshness", api.fetcher);

  const [tab, setTab] = useState<StatusKey>("new");

  const { data: counts, mutate: mutateCounts } = useSWR<{ new: number; in_progress: number; addressed: number; dismissed: number; total: number }>(
    status?.content_count ? "/api/content/gaps/counts" : null,
    api.fetcher
  );

  const { data: gaps, mutate: mutateGaps } = useSWR<ContentGap[]>(
    status?.content_count ? `/api/content/gaps?status=${tab}&limit=100` : null,
    api.fetcher
  );

  const [scanning, setScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [writingFor, setWritingFor] = useState<{ keyword: string; category: string | null } | null>(null);

  const scan = async () => {
    setScanning(true);
    setMsg(null);
    try {
      const r = await api.scanContent();
      if (r.status === "ok") {
        setMsg(`Site tarandı: ${r.total} içerik (${r.blog} blog + ${r.page} sayfa).`);
        mutateStatus();
      }
    } catch (e: any) {
      setMsg(`Hata: ${e.message}`);
    } finally {
      setScanning(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setMsg(null);
    try {
      const r = await api.refreshContentGaps();
      setMsg(`Yenileme: ${r.added} yeni, ${r.updated} güncellendi, ${r.marked_stale} artık trend değil.`);
      mutateGaps(); mutateCounts();
    } catch (e: any) {
      setMsg(`Hata: ${e.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const setStatus = async (gap: ContentGap, newStatus: ContentGap["status"]) => {
    if (!gap.id || !newStatus) return;
    let url: string | undefined;
    if (newStatus === "addressed") {
      url = prompt(`"${gap.keyword}" için yazılan post URL'si (opsiyonel):`) || undefined;
    }
    try {
      await api.setGapStatus(gap.id, newStatus, url);
      mutateGaps(); mutateCounts();
    } catch (e: any) {
      alert(`Hata: ${e.message}`);
    }
  };

  if (!status) return null;

  if (!status.configured) {
    return (
      <section className="card card-pad mb-6 border-dashed">
        <div className="text-xs font-medium text-ink-500 uppercase tracking-wide">İçerik Boşlukları</div>
        <h2 className="font-medium text-ink-900 mt-1">1e1kod.org yolu tanımlı değil</h2>
        <p className="text-sm text-ink-500 mt-2">
          <code>backend/.env</code> içinde <code>KOD_ORG_PATH</code> ayarla.
        </p>
      </section>
    );
  }

  if (status.content_count === 0) {
    return (
      <section className="card card-pad mb-6 border-dashed">
        <div className="text-xs font-medium text-ink-500 uppercase tracking-wide">İçerik Boşlukları</div>
        <h2 className="font-medium text-ink-900 mt-1">Site henüz taranmadı</h2>
        <p className="text-sm text-ink-500 mt-2 mb-3">
          1e1kod.org'daki blog post + sayfa listesini taramak için butona bas.
        </p>
        <button className="btn-primary" onClick={scan} disabled={scanning}>
          {scanning ? "Taranıyor…" : "Siteyi Tara"}
        </button>
        {msg && <div className="text-sm text-ink-700 mt-3">{msg}</div>}
      </section>
    );
  }

  return (
    <section className="card card-pad mb-6 border-amber-100 bg-gradient-to-br from-amber-50/40 to-white">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-xs font-medium text-amber-700 uppercase tracking-wide">
            İçerik Boşlukları · 1e1kod.org
          </div>
          <h2 className="text-lg font-semibold text-ink-900 mt-1">Trend ama henüz yazılmamış</h2>
          <p className="text-xs text-ink-500 mt-1">
            Site taraması: {relativeTime(status.last_scanned_at)}
            {freshness?.content_gaps_last_refresh && (
              <span> · son fırsat tespiti: {relativeTime(freshness.content_gaps_last_refresh)}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost text-xs" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Yenileniyor…" : "Şimdi Yenile"}
          </button>
          <button className="btn-ghost text-xs" onClick={scan} disabled={scanning}>
            {scanning ? "Taranıyor…" : "Siteyi Yeniden Tara"}
          </button>
        </div>
      </div>

      {msg && <div className="text-sm text-ink-700 mb-3">{msg}</div>}

      <div className="flex gap-1 mb-4 flex-wrap">
        {(["new", "in_progress", "all", "addressed", "dismissed"] as StatusKey[]).map((s) => {
          const count = s === "all" ? counts?.total : counts?.[s];
          const active = tab === s;
          return (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`text-xs px-3 py-1.5 rounded-md border transition ${
                active
                  ? "bg-amber-100 text-amber-800 border-amber-200 font-medium"
                  : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
              }`}
            >
              {STATUS_LABELS[s]}
              {typeof count === "number" && (
                <span className={`ml-1.5 text-[10px] ${active ? "text-amber-700" : "text-ink-500"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!gaps && <div className="text-sm text-ink-500">Yükleniyor…</div>}
      {gaps && gaps.length === 0 && (
        <div className="text-sm text-ink-500 py-6 text-center">
          Bu durumda fırsat yok.
        </div>
      )}

      {gaps && gaps.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-500">
                <th className="font-medium py-2 pr-3">Kelime</th>
                <th className="font-medium py-2 pr-3">Durum</th>
                <th className="font-medium py-2 pr-3">İlk Tespit</th>
                <th className="font-medium py-2 pr-3 text-right">Kapsam</th>
                <th className="font-medium py-2 pr-3 text-right">Büyüme</th>
                <th className="font-medium py-2 pr-3 text-right">Öncelik</th>
                <th className="font-medium py-2 pr-3">Eylem</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g) => {
                const days = daysSince(g.first_detected_at);
                const trending = g.is_currently_trending;
                return (
                  <tr key={g.id || g.keyword} className="border-t border-ink-100 hover:bg-amber-50/30 align-top">
                    <td className="py-2.5 pr-3">
                      <a
                        href={`/explorer?q=${encodeURIComponent(g.keyword)}`}
                        className="text-ink-900 hover:text-brand-700 font-medium"
                      >
                        {g.keyword}
                      </a>
                      <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {g.category && <span className="badge badge-cat">{g.category}</span>}
                        {g.source === "rising" && <span className="text-ink-400">yükselen</span>}
                        {!trending && g.status !== "addressed" && (
                          <span className="badge badge-down">artık trend değil</span>
                        )}
                        {trending && <span className="badge badge-up">şu an trend</span>}
                      </div>
                      {g.addressed_url && (
                        <div className="text-xs mt-1">
                          <a href={g.addressed_url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
                            ✓ Yazılan: {g.addressed_url.replace(/^https?:\/\//, "").slice(0, 40)}
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={g.status || "new"} />
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-ink-500">
                      <div>{fmtDate(g.first_detected_at)}</div>
                      <div className="text-[10px]">
                        {days === 0 ? "bugün" : `${days}g önce`}
                        {g.times_detected && g.times_detected > 1 && ` · ${g.times_detected}x görüldü`}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      <span className={g.coverage_score < 0.3 ? "text-red-600" : "text-amber-700"}>
                        {Math.round(g.coverage_score * 100)}%
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {g.growth_pct !== 0 ? (
                        <span className={g.growth_pct > 0 ? "text-emerald-700" : "text-red-600"}>
                          {g.growth_pct > 0 ? "+" : ""}{g.growth_pct.toFixed(0)}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-ink-900">
                      {g.priority.toFixed(0)}
                      {g.peak_priority && g.peak_priority > g.priority + 1 && (
                        <div className="text-[10px] text-ink-500">zirve: {g.peak_priority.toFixed(0)}</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <ActionMenu gap={g} onChange={setStatus} />
                      <button
                        className="text-[10px] mt-1 px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => setWritingFor({ keyword: g.keyword, category: g.category })}
                      >
                        ✍️ AI Yaz
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ink-500 mt-3">
        💡 <strong>✍️ AI Yaz</strong> — kelime için tam blog yazısı + sosyal medya paketi üretir.
      </p>

      {writingFor && (
        <ArticleWriter
          keyword={writingFor.keyword}
          category={writingFor.category}
          onClose={() => setWritingFor(null)}
        />
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: NonNullable<ContentGap["status"]> }) {
  const map: Record<typeof status, string> = {
    new: "bg-blue-50 text-blue-700 border-blue-100",
    in_progress: "bg-amber-50 text-amber-700 border-amber-100",
    addressed: "bg-emerald-50 text-emerald-700 border-emerald-100",
    dismissed: "bg-ink-100 text-ink-500 border-ink-200",
  };
  return <span className={`badge border ${map[status]}`}>{STATUS_LABELS[status]}</span>;
}

function ActionMenu({ gap, onChange }: { gap: ContentGap; onChange: (g: ContentGap, s: ContentGap["status"]) => void }) {
  const current = gap.status || "new";
  return (
    <select
      className="text-xs border border-ink-200 rounded px-1.5 py-1 bg-white hover:border-ink-400"
      value={current}
      onChange={(e) => onChange(gap, e.target.value as ContentGap["status"])}
    >
      <option value="new">Yeni</option>
      <option value="in_progress">İşleniyor</option>
      <option value="addressed">Yazıldı ✓</option>
      <option value="dismissed">İptal</option>
    </select>
  );
}
