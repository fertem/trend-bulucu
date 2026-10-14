"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, ActionItem, ActionsResponse } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useToast } from "./ui/Toast";
import { SkeletonTable } from "./ui/Skeleton";
import { Icon } from "./icons";

const TYPE_STYLE: Record<ActionItem["type"], { tone: string; icon: (p: { size?: number; className?: string }) => JSX.Element }> = {
  title_ctr: { tone: "bg-amber-50 text-amber-700 border-amber-100", icon: Icon.Seo },
  page2_push: { tone: "bg-brand-50 text-brand-700 border-brand-100", icon: Icon.Trend },
  write_gap: { tone: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: Icon.Sparkles },
  seasonal_prep: { tone: "bg-purple-50 text-purple-700 border-purple-100", icon: Icon.Clock },
  falling: { tone: "bg-red-50 text-red-700 border-red-100", icon: Icon.Alert },
  cannibalization: { tone: "bg-pink-50 text-pink-700 border-pink-100", icon: Icon.Category },
  spike: { tone: "bg-cyan-50 text-cyan-700 border-cyan-100", icon: Icon.Opportunity },
};

export function ActionFeed() {
  const t = useT();
  const toast = useToast();
  const [showAll, setShowAll] = useState(false);
  const { data, mutate, isLoading } = useSWR<ActionsResponse>(
    `/api/insights/actions?limit=${showAll ? 50 : 8}`,
    api.fetcher,
    { refreshInterval: 5 * 60_000 },
  );

  const setState = async (a: ActionItem, status: "done" | "snoozed") => {
    // iyimser güncelleme
    mutate(
      (prev) => prev ? { ...prev, items: prev.items.filter((i) => i.id !== a.id) } : prev,
      { revalidate: false },
    );
    try {
      await api.setActionState(a.id, status);
      toast.success(status === "done" ? t.actions.markedDone : t.actions.snoozed);
      mutate();
    } catch (e: any) {
      toast.error(t.common.error, e.message);
      mutate();
    }
  };

  if (isLoading && !data) {
    return (
      <section className="card card-pad mb-6">
        <div className="overline mb-3">{t.actions.overline}</div>
        <SkeletonTable rows={4} cols={3} />
      </section>
    );
  }
  if (!data) return null;

  const items = data.items;
  const pending = data.counts.open;

  return (
    <section className="card card-pad mb-6">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="overline flex items-center gap-1.5">
            <Icon.Check size={13} />
            {t.actions.overline}
          </div>
          <h2 className="text-lg font-semibold text-ink-900 mt-0.5">{t.actions.title}</h2>
          <p className="text-xs text-ink-500 mt-0.5">
            {pending > 0 ? t.actions.pendingCount(pending) : t.actions.allClear}
            {data.counts.done > 0 && ` · ${t.actions.doneCount(data.counts.done)}`}
          </p>
        </div>
        {data.total_candidates > 8 && (
          <button className="btn-ghost btn-sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? t.common.showLess : t.common.showAll}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
          <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
            <Icon.Check size={13} strokeWidth={3} />
          </span>
          {t.actions.emptyHint}
        </div>
      ) : (
        <ul className="divide-y divide-ink-100">
          {items.map((a) => {
            const st = TYPE_STYLE[a.type] ?? TYPE_STYLE.write_gap;
            const I = st.icon;
            const label = t.actions.types[a.type] ?? a.type;
            const detail = t.actions.detail[a.type] ? t.actions.detail[a.type](a.params) : "";
            return (
              <li key={a.id} className="py-3 flex items-start gap-3">
                <span className={`mt-0.5 w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${st.tone}`}>
                  <I size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge border ${st.tone}`}>{label}</span>
                    <Link href={a.href} className="text-sm font-medium text-ink-900 hover:text-brand-700 truncate">
                      {a.keyword}
                    </Link>
                    <span className="text-[11px] text-ink-400 tabular-nums ml-auto">{t.actions.priority} {a.priority}</span>
                  </div>
                  {detail && <p className="text-xs text-ink-500 mt-1">{detail}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link href={a.href} className="btn-primary btn-sm" title={t.actions.go}>
                    {t.actions.go}
                  </Link>
                  <button className="btn-ghost btn-sm" onClick={() => setState(a, "done")} title={t.actions.done}>
                    <Icon.Check size={13} />
                    <span className="hidden sm:inline">{t.actions.done}</span>
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => setState(a, "snoozed")} title={t.actions.snooze}>
                    <Icon.Clock size={13} />
                    <span className="hidden sm:inline">{t.actions.snooze}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
