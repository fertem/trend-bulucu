"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, SCQuery, SCOpportunity, SCMover, SCStatus } from "@/lib/api";
import { parseBackendDate } from "@/lib/format";
import { useT, useLang } from "@/lib/i18n";

type Tab = "top" | "opportunities" | "page2" | "movers";

function fmtCtr(ctr: number) {
  return `${(ctr * 100).toFixed(1)}%`;
}

function fmtPos(p: number | null | undefined) {
  if (p === null || p === undefined) return "—";
  return p.toFixed(1);
}

export function SearchConsoleCard() {
  const t = useT();
  const { lang } = useLang();
  const TAB_LABELS = t.sc.tabs;
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
        setMsg(t.sc.syncResult(r.imported ?? 0, r.period_start ?? "", r.period_end ?? ""));
        mutateStatus();
      } else if (r.status === "error") {
        setMsg(`${t.common.error}: ${r.error}`);
      } else if (r.status === "disabled") {
        setMsg(t.sc.siteRequired);
      }
    } catch (e: any) {
      setMsg(`${t.common.error}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  if (!status) return null;

  if (!status.site_configured) {
    return <SetupWizard onComplete={() => mutateStatus()} />;
  }

  if (status.row_count === 0) {
    return (
      <section className="card card-pad mb-6 border-dashed border-cyan-200 bg-cyan-50/30">
        <div className="text-xs font-medium text-cyan-700 uppercase tracking-wide">{t.sc.overline}</div>
        <h2 className="font-medium text-ink-900 mt-1">{t.sc.siteConnected}: {status.site_url}</h2>
        <p className="text-sm text-ink-500 mt-2 mb-3">{t.sc.noDataYet}</p>
        <button className="btn-primary" onClick={sync} disabled={busy === "sync"}>
          {busy === "sync" ? t.sc.syncing : t.sc.syncNow}
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
          <div className="text-xs font-medium text-cyan-700 uppercase tracking-wide">{t.sc.overline} · {t.sc.last28Days}</div>
          <h2 className="text-lg font-semibold text-ink-900 mt-1">{t.sc.seoPerformance}</h2>
          <p className="text-xs text-ink-500 mt-1">
            {status.site_url} · {status.row_count} {t.sc.queries} · {t.sc.lastSync}: {(() => { const d = parseBackendDate(status.last_sync_at); return d ? d.toLocaleString(lang === "en" ? "en-US" : "tr-TR") : "—"; })()}
          </p>
        </div>
        <button className="btn-ghost text-xs" onClick={sync} disabled={busy === "sync"}>
          {busy === "sync" ? t.sc.refreshing : t.sc.refreshNow}
        </button>
      </div>

      {msg && <div className="text-sm text-ink-700 mb-3">{msg}</div>}

      <div className="flex gap-1 mb-4 flex-wrap">
        {(["top", "opportunities", "page2", "movers"] as Tab[]).map((tk) => (
          <button
            key={tk}
            onClick={() => setTab(tk)}
            className={`text-xs px-3 py-1.5 rounded-md border transition ${
              tab === tk
                ? "bg-cyan-100 text-cyan-800 border-cyan-200 font-medium"
                : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
            }`}
          >
            {TAB_LABELS[tk]}
          </button>
        ))}
      </div>

      {activeRows.length === 0 && <div className="text-sm text-ink-500 py-4">{t.sc.emptyData}</div>}

      {activeRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-500">
                <th className="font-medium py-2 pr-3">{t.sc.th.query}</th>
                <th className="font-medium py-2 pr-3 text-right">{t.sc.th.clicks}</th>
                <th className="font-medium py-2 pr-3 text-right">{t.sc.th.impressions}</th>
                <th className="font-medium py-2 pr-3 text-right">{t.sc.th.ctr}</th>
                <th className="font-medium py-2 pr-3 text-right">{t.sc.th.position}</th>
                {tab === "opportunities" && (
                  <th className="font-medium py-2 pr-3 text-right">{t.sc.th.potential}</th>
                )}
                {tab === "movers" && (
                  <th className="font-medium py-2 pr-3 text-right">{t.sc.th.delta}</th>
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
                      <div className="text-[10px] text-ink-500">{t.sc.expected}: {fmtCtr(r.expected_ctr)}</div>
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
                      <div className="text-[10px] text-ink-500">{t.sc.previous}: {fmtPos(r.prev_position)}</div>
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

      <p className="text-xs text-ink-500 mt-3">{t.sc.legend}</p>
    </section>
  );
}

function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const t = useT();
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
          ? t.sc.scopeMissing
          : (e.message || t.sc.listFail)
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
      <div className="text-xs font-medium text-cyan-700 uppercase tracking-wide">{t.sc.overline}</div>
      <h2 className="font-medium text-ink-900 mt-1">{t.sc.setupTitle}</h2>
      <p className="text-sm text-ink-500 mt-2 mb-3">{t.sc.setupHint}</p>

      {!sites && (
        <>
          <ol className="text-sm text-ink-700 space-y-1 mb-3 list-decimal list-inside">
            {t.sc.setupSteps.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
          <button className="btn-primary" onClick={fetchSites} disabled={loading}>
            {loading ? t.sc.listing : t.sc.listSites}
          </button>
          {error && <div className="text-sm text-red-600 mt-3">{error}</div>}
        </>
      )}

      {sites && sites.length === 0 && (
        <div className="text-sm text-ink-500">
          {t.sc.noVerified} <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline">Search Console</a>
        </div>
      )}

      {sites && sites.length > 0 && (
        <>
          <div className="text-sm text-ink-700 mb-2">{t.sc.pickSite}</div>
          <div className="space-y-2">
            {sites.map((s) => (
              <button
                key={s.url}
                onClick={() => choose(s.url)}
                disabled={picked !== null}
                className="w-full text-left p-3 rounded-md border border-ink-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/30 disabled:opacity-50"
              >
                <div className="font-medium text-ink-900 text-sm">{s.url}</div>
                <div className="text-xs text-ink-500">{t.sc.permission}: {s.permission}</div>
                {picked === s.url && <div className="text-xs text-emerald-700 mt-1">{t.sc.pickedRestart}</div>}
              </button>
            ))}
          </div>
          {error && <div className="text-sm text-red-600 mt-3">{error}</div>}
        </>
      )}
    </section>
  );
}
