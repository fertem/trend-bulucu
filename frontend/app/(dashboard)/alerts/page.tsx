"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, AlertItem, AlertsResponse } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/icons";
import { relativeTime } from "@/lib/format";
import { useT } from "@/lib/i18n";

type Sev = "all" | "critical" | "warn" | "info";

const SEV_DOT: Record<string, string> = {
  critical: "bg-red-500",
  warn: "bg-amber-500",
  info: "bg-brand-500",
};
const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-100",
  warn: "bg-amber-50 text-amber-700 border-amber-100",
  info: "bg-brand-50 text-brand-700 border-brand-100",
};
const TYPE_ICON: Record<AlertItem["type"], (p: { size?: number; className?: string }) => JSX.Element> = {
  hot: Icon.Trend,
  falling: Icon.Alert,
  spike: Icon.Opportunity,
  seasonal_peak_ahead: Icon.Clock,
  sc_drop: Icon.Seo,
};

export default function AlertsPage() {
  const t = useT();
  const toast = useToast();
  const [sev, setSev] = useState<Sev>("all");
  const [showMuted, setShowMuted] = useState(false);
  const [busy, setBusy] = useState<"generate" | "seen" | null>(null);

  const { data, isLoading, error, mutate } = useSWR<AlertsResponse>(
    `/api/alerts?limit=200${sev !== "all" ? `&severity=${sev}` : ""}`,
    api.fetcher,
  );

  const setState = async (a: AlertItem, status: "seen" | "muted" | "new") => {
    mutate(
      (prev) => prev ? { ...prev, items: prev.items.map((i) => (i.id === a.id ? { ...i, status } : i)) } : prev,
      { revalidate: false },
    );
    try {
      await api.setAlertState(a.id, status);
      if (status === "muted") toast.info(t.alertsPage.mutedToast);
      mutate();
    } catch (e: any) {
      toast.error(t.common.error, e.message);
      mutate();
    }
  };

  const generate = async () => {
    setBusy("generate");
    try {
      const r = await api.generateAlerts();
      toast.success(t.alertsPage.generated(r.new_count, r.candidates));
      mutate();
    } catch (e: any) {
      toast.error(t.common.error, e.message);
    } finally {
      setBusy(null);
    }
  };

  const markAllSeen = async () => {
    setBusy("seen");
    try {
      const r = await api.markAllAlertsSeen();
      toast.success(t.alertsPage.markedSeen(r.updated));
      mutate();
    } catch (e: any) {
      toast.error(t.common.error, e.message);
    } finally {
      setBusy(null);
    }
  };

  const counts = data?.counts;
  const items = (data?.items ?? []).filter((i) => showMuted || i.status !== "muted");

  return (
    <div>
      <PageHeader
        title={t.alerts.title}
        subtitle={t.alertsPage.subtitle}
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={markAllSeen} disabled={busy !== null || !counts?.new}>
              <Icon.Check size={14} />
              {t.alertsPage.markAllSeen}
            </button>
            <button className="btn-primary btn-sm" onClick={generate} disabled={busy !== null}>
              {busy === "generate" ? <Icon.Spinner size={14} /> : <Icon.Refresh size={14} />}
              {t.alertsPage.generateNow}
            </button>
          </>
        }
      />

      {/* Bildirim durumu */}
      {data && (
        <div className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm ${
          data.notify.configured ? "border-emerald-100 bg-emerald-50/60 text-emerald-800" : "border-ink-200 bg-ink-50 text-ink-700"
        }`}>
          <Icon.Alert size={16} className="shrink-0" />
          <div className="flex-1 min-w-0">
            {data.notify.configured
              ? t.alertsPage.notifyOn([data.notify.telegram ? "Telegram" : null, data.notify.slack ? "Slack" : null].filter(Boolean).join(" + "), t.alertsPage.severity[data.notify.min_severity as "info" | "warn" | "critical"])
              : t.alertsPage.notifyOff}
          </div>
          <Link href="/settings" className="btn-ghost btn-sm shrink-0">{t.alertsPage.notifySettings}</Link>
        </div>
      )}

      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-1.5 mb-5">
        {(["all", "critical", "warn", "info"] as Sev[]).map((s) => {
          const n = s === "all" ? counts?.total : counts?.[s];
          return (
            <button
              key={s}
              onClick={() => setSev(s)}
              className={`btn-ghost btn-sm ${sev === s ? "border-brand-200 bg-brand-50 text-brand-700" : ""}`}
            >
              {s !== "all" && <span className={`w-2 h-2 rounded-full ${SEV_DOT[s]}`} />}
              {s === "all" ? t.common.all : t.alertsPage.severity[s]}
              {typeof n === "number" && <span className="text-[10px] tabular-nums opacity-70">{n}</span>}
            </button>
          );
        })}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-500 cursor-pointer select-none">
          <input type="checkbox" checked={showMuted} onChange={(e) => setShowMuted(e.target.checked)} />
          {t.alertsPage.showMuted} {counts?.muted ? `(${counts.muted})` : ""}
        </label>
      </div>

      {isLoading && !data && <SkeletonCard lines={6} />}
      {error && <div className="text-sm text-red-600">{t.common.error}: {String((error as any).message || error)}</div>}

      {data && items.length === 0 && (
        <section className="card">
          <EmptyState
            icon={<Icon.Check size={22} />}
            title={t.alerts.noAlerts}
            description={counts?.last_generated_at ? t.alertsPage.lastGenerated(relativeTime(counts.last_generated_at)) : t.alertsPage.neverGenerated}
            action={{ label: t.alertsPage.generateNow, onClick: generate }}
          />
        </section>
      )}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((a) => {
            const I = TYPE_ICON[a.type] ?? Icon.Alert;
            const desc = t.alertsPage.describe[a.type] ? t.alertsPage.describe[a.type](a.params) : "";
            const isNew = a.status === "new";
            const isMuted = a.status === "muted";
            return (
              <li
                key={a.id}
                className={`card card-pad flex items-start gap-3 ${isMuted ? "opacity-60" : ""} ${isNew ? "border-l-4" : ""} ${
                  isNew && a.severity === "critical" ? "border-l-red-500" : isNew && a.severity === "warn" ? "border-l-amber-500" : isNew ? "border-l-brand-500" : ""
                }`}
              >
                <span className={`mt-0.5 w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${SEV_BADGE[a.severity]}`}>
                  <I size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge border ${SEV_BADGE[a.severity]}`}>{t.alertsPage.severity[a.severity]}</span>
                    <span className="badge badge-down">{t.alertsPage.types[a.type] ?? a.type}</span>
                    <Link href={a.href || "#"} className="text-sm font-medium text-ink-900 hover:text-brand-700 truncate">
                      {a.keyword}
                    </Link>
                    {isNew && <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-700">{t.alertsPage.newTag}</span>}
                  </div>
                  {desc && <p className="text-xs text-ink-500 mt-1">{desc}</p>}
                  <p className="text-[11px] text-ink-400 mt-1">
                    {t.alertsPage.firstSeen} {relativeTime(a.first_seen)} · {t.alertsPage.lastSeen} {relativeTime(a.last_seen)}
                    {isMuted && a.mute_until && ` · ${t.alertsPage.mutedUntil} ${relativeTime(a.mute_until)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isNew && (
                    <button className="btn-ghost btn-sm" onClick={() => setState(a, "seen")} title={t.alertsPage.seen}>
                      <Icon.Check size={13} />
                      <span className="hidden sm:inline">{t.alertsPage.seen}</span>
                    </button>
                  )}
                  {isMuted ? (
                    <button className="btn-ghost btn-sm" onClick={() => setState(a, "seen")}>{t.alertsPage.unmute}</button>
                  ) : (
                    <button className="btn-ghost btn-sm" onClick={() => setState(a, "muted")} title={t.alertsPage.mute}>
                      <Icon.Clock size={13} />
                      <span className="hidden sm:inline">{t.alertsPage.mute}</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
