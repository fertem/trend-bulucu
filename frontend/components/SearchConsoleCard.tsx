"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, SCQuery, SCOpportunity, SCMover, SCStatus } from "@/lib/api";

type Tab = "top" | "opportunities" | "page2" | "movers";

const TAB_LABELS: Record<Tab, string> = {
  top: "Top Tıklama",
  opportunities: "Başlık Fırsatı",
  page2: "Sayfa 2 (11-20)",
  movers: "Hareket",
};

function fmtCtr(ctr: number) {
  return `${(ctr * 100).toFixed(1)}%`;
}

function fmtPos(p: number | null | undefined) {
  if (p === null || p === undefined) return "—";
  return p.toFixed(1);
}

export function SearchConsoleCard() {
  const { data: status, mutate: mutateStatus } = useSWR<SCStatus>("/api/sc/status", api.fetcher);
  const [tab, setTab] = useState<Tab>("top");
  const [busy, setBusy] = useState<"site" | "sync" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const { data: queries } = useSWR<SCQuery[]>(
    status?.row_count ? "/api/sc/queries?limit=15" : null,
    api.fetcher
  );
  const { data: opps } = useSWR<SCOpportunity[]>(
    status?.row_count && tab === "opportunities" ? "/api/sc/opportunities?limit=15" : null,
    api.fetcher
  );
  const { data: page2 } = useSWR<SCQuery[]>(
    status?.row_count && tab === "page2" ? "/api/sc/page2?limit=15" : null,
    api.fetcher
  );
  const { data: movers } = useSWR<SCMover[]>(
    status?.row_count && tab === "movers" ? "/api/sc/movers?limit=15" : null,
    api.fetcher
  );

  const sync = async () => {
    setBusy("sync");
    setMsg(null);
    try {
      const r = await api.scSync(28);
      if (r.status === "ok") {
        setMsg(`✓ ${r.imported} satır içe aktarıldı (${r.period_start} → ${r.period_end})`);
        mutateStatus();
      } else if (r.status === "error") {
        setMsg(`Hata: ${r.error}`);
      } else if (r.status === "disabled") {
        setMsg("Önce Search Console sitesi ayarlanmalı.");
      }
    } catch (e: any) {
      setMsg(`Hata: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  if (!status) return null;

  // Setup wizard
  if (!status.site_configured) {
    return <SetupWizard onComplete={() => mutateStatus()} />;
  }

  if (status.row_count === 0) {
    return (
      <section className="card card-pad mb-6 border-dashed border-cyan-200 bg-cyan-50/30">
        <div className="text-xs font-medium text-cyan-700 uppercase tracking-wide">Search Console</div>
        <h2 className="font-medium text-ink-900 mt-1">Site bağlandı: {status.site_url}</h2>
        <p className="text-sm text-ink-500 mt-2 mb-3">
          Henüz veri çekilmedi. "Şimdi Senkronize Et" butonuna basıp son 28 günü içe aktar (~5-10 sn).
        </p>
        <button className="btn-primary" onClick={sync} disabled={busy === "sync"}>
          {busy === "sync" ? "Çekiliyor…" : "Şimdi Senkronize Et"}
        </button>
        {msg && <div className="text-sm text-ink-700 mt-3">{msg}</div>}
      </section>
    );
  }

  const activeRows: any[] =
    tab === "top" ? queries || []
    : tab === "opportunities" ? opps || []
    : tab === "page2" ? page2 || []
    : movers || [];

  return (
    <section className="card card-pad mb-6 border-cyan-100 bg-gradient-to-br from-cyan-50/40 to-white">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-xs font-medium text-cyan-700 uppercase tracking-wide">Search Console · Son 28 gün</div>
          <h2 className="text-lg font-semibold text-ink-900 mt-1">SEO Performansı</h2>
          <p className="text-xs text-ink-500 mt-1">
            {status.site_url} · {status.row_count} sorgu · son sync: {status.last_sync_at ? new Date(status.last_sync_at).toLocaleString("tr-TR") : "—"}
          </p>
        </div>
        <button className="btn-ghost text-xs" onClick={sync} disabled={busy === "sync"}>
          {busy === "sync" ? "Senkronize Ediliyor…" : "Şimdi Yenile"}
        </button>
      </div>

      {msg && <div className="text-sm text-ink-700 mb-3">{msg}</div>}

      <div className="flex gap-1 mb-4 flex-wrap">
        {(["top", "opportunities", "page2", "movers"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-md border transition ${
              tab === t
                ? "bg-cyan-100 text-cyan-800 border-cyan-200 font-medium"
                : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {activeRows.length === 0 && <div className="text-sm text-ink-500 py-4">Bu kategoride veri yok.</div>}

      {activeRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-500">
                <th className="font-medium py-2 pr-3">Sorgu</th>
                <th className="font-medium py-2 pr-3 text-right">Tıklama</th>
                <th className="font-medium py-2 pr-3 text-right">Gösterim</th>
                <th className="font-medium py-2 pr-3 text-right">CTR</th>
                <th className="font-medium py-2 pr-3 text-right">Pozisyon</th>
                {tab === "opportunities" && (
                  <th className="font-medium py-2 pr-3 text-right">Potansiyel</th>
                )}
                {tab === "movers" && (
                  <th className="font-medium py-2 pr-3 text-right">Δ Pozisyon</th>
                )}
              </tr>
            </thead>
            <tbody>
              {activeRows.map((r: any, i) => (
                <tr key={i} className="border-t border-ink-100 hover:bg-cyan-50/30">
                  <td className="py-2 pr-3">
                    <a
                      href={`/explorer?q=${encodeURIComponent(r.query)}`}
                      className="text-ink-900 hover:text-brand-700"
                    >
                      {r.query}
                    </a>
                    {r.page && (
                      <div className="text-xs text-ink-500 truncate max-w-[280px]">
                        → {r.page.replace(/^https?:\/\/(www\.)?/, "")}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.clicks}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-ink-500">{r.impressions}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {fmtCtr(r.ctr)}
                    {tab === "opportunities" && r.expected_ctr && (
                      <div className="text-[10px] text-ink-500">bekl: {fmtCtr(r.expected_ctr)}</div>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    <span className={
                      r.position <= 3 ? "text-emerald-700 font-medium" :
                      r.position <= 10 ? "text-ink-900" :
                      r.position <= 20 ? "text-amber-700" : "text-ink-500"
                    }>
                      {fmtPos(r.position)}
                    </span>
                    {r.prev_position !== null && r.prev_position !== undefined && tab !== "movers" && (
                      <div className="text-[10px] text-ink-500">önc: {fmtPos(r.prev_position)}</div>
                    )}
                  </td>
                  {tab === "opportunities" && (
                    <td className="py-2 pr-3 text-right tabular-nums text-emerald-700 font-medium">
                      +{r.potential_clicks}
                    </td>
                  )}
                  {tab === "movers" && (
                    <td className="py-2 pr-3 text-right tabular-nums">
                      <span className={r.direction === "up" ? "text-emerald-700" : "text-red-600"}>
                        {r.direction === "up" ? "↑" : "↓"} {Math.abs(r.position_delta).toFixed(1)}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ink-500 mt-3">
        💡 <strong>Top Tıklama</strong>: en çok trafik getiren kelimeler. <strong>Başlık Fırsatı</strong>:
        gösterim var ama tıklama az = title iyileştirme. <strong>Sayfa 2</strong>: 11-20 arası, küçük itmeyle ilk sayfa.
        <strong>Hareket</strong>: pozisyonu değişen kelimeler.
      </p>
    </section>
  );
}

function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [sites, setSites] = useState<{ url: string; permission: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const fetchSites = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.scListSites();
      setSites(r.sites);
    } catch (e: any) {
      setError(
        e.message?.includes("OAuth") || e.message?.includes("scope") || e.message?.includes("403")
          ? "OAuth scope eksik. backend/setup_google_ads.py script'ini yeniden çalıştır (yeni scope ile)."
          : (e.message || "Liste alınamadı")
      );
    } finally {
      setLoading(false);
    }
  };

  const choose = async (url: string) => {
    setPicked(url);
    try {
      await api.scSetSite(url);
      onComplete();
    } catch (e: any) {
      setError(e.message);
      setPicked(null);
    }
  };

  return (
    <section className="card card-pad mb-6 border-dashed border-cyan-200 bg-cyan-50/20">
      <div className="text-xs font-medium text-cyan-700 uppercase tracking-wide">Search Console</div>
      <h2 className="font-medium text-ink-900 mt-1">Bağlantı Kurulumu</h2>
      <p className="text-sm text-ink-500 mt-2 mb-3">
        Bu modül 1e1kod.org'un Google Search Console verisini çeker (gerçek pozisyon, CTR, tıklama, gösterim).
      </p>

      {!sites && (
        <>
          <ol className="text-sm text-ink-700 space-y-1 mb-3 list-decimal list-inside">
            <li><code>backend</code> klasöründe terminal aç</li>
            <li><code>venv\Scripts\python.exe setup_google_ads.py</code> çalıştır (scope güncellendi, yeni OAuth gerekli)</li>
            <li>Tarayıcıda Google'a tekrar giriş yap, izin ver</li>
            <li>Backend'i yeniden başlat</li>
            <li>Aşağıdaki butona bas</li>
          </ol>
          <button className="btn-primary" onClick={fetchSites} disabled={loading}>
            {loading ? "Listeleniyor…" : "Sitelerimi Listele"}
          </button>
          {error && <div className="text-sm text-red-600 mt-3">{error}</div>}
        </>
      )}

      {sites && sites.length === 0 && (
        <div className="text-sm text-ink-500">
          Doğrulanmış site bulunamadı. <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline">Search Console'da</a> 1e1kod.org'un doğrulanmış olduğundan emin ol.
        </div>
      )}

      {sites && sites.length > 0 && (
        <>
          <div className="text-sm text-ink-700 mb-2">Hangi siteden veri çekelim?</div>
          <div className="space-y-2">
            {sites.map((s) => (
              <button
                key={s.url}
                onClick={() => choose(s.url)}
                disabled={picked !== null}
                className="w-full text-left p-3 rounded-md border border-ink-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/30 disabled:opacity-50"
              >
                <div className="font-medium text-ink-900 text-sm">{s.url}</div>
                <div className="text-xs text-ink-500">izin: {s.permission}</div>
                {picked === s.url && <div className="text-xs text-emerald-700 mt-1">✓ seçildi — backend'i yeniden başlat</div>}
              </button>
            ))}
          </div>
          {error && <div className="text-sm text-red-600 mt-3">{error}</div>}
        </>
      )}
    </section>
  );
}
