"use client";

import Link from "next/link";
import useSWR from "swr";
import { api, CalendarResponse, CalendarItem } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/icons";
import { useT, useLang } from "@/lib/i18n";

function fmtDate(iso: string, lang: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(lang === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "short" });
}

export default function CalendarPage() {
  const t = useT();
  const { lang } = useLang();
  const { data, isLoading, error } = useSWR<CalendarResponse>("/api/calendar?months=12", api.fetcher);
  const months = t.calendar.months;

  return (
    <div>
      <PageHeader title={t.calendar.title} subtitle={t.calendar.subtitle} />

      {isLoading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      )}
      {error && <div className="text-sm text-red-600">{t.common.error}: {String((error as any).message || error)}</div>}

      {data && data.historical_keywords === 0 && (
        <section className="card">
          <EmptyState
            icon={<Icon.Calendar size={22} />}
            title={t.calendar.noHistorical}
            description={t.calendar.noHistoricalHint}
            action={{ label: t.nav.admin, href: "/admin" }}
          />
        </section>
      )}

      {data && data.historical_keywords > 0 && (
        <>
          <div className="card card-pad mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-500">
            <span><span className="font-medium text-ink-700">{data.seasonal_keywords}</span> {t.calendar.statSeasonal(data.historical_keywords)}</span>
            <span><span className="font-medium text-ink-700">{data.total_items}</span> {t.calendar.statSlots}</span>
            <span className="flex items-center gap-1.5"><span className="badge border bg-emerald-50 text-emerald-700 border-emerald-100">{t.calendar.actions.write}</span> {t.calendar.legendWrite}</span>
            <span className="flex items-center gap-1.5"><span className="badge border bg-brand-50 text-brand-700 border-brand-100">{t.calendar.actions.refresh}</span> {t.calendar.legendRefresh}</span>
            <span className="ml-auto">{t.calendar.rule(data.lead_days, data.min_peak_lift)}</span>
          </div>

          {data.total_items === 0 && (
            <section className="card mb-5">
              <EmptyState compact title={t.calendar.noSeasonal} description={t.calendar.noSeasonalHint} />
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.months.map((mo) => {
              const label = `${months[mo.month - 1]} ${mo.year}`;
              const count = mo.items.length;
              return (
                <section
                  key={`${mo.year}-${mo.month}`}
                  className={`card min-w-0 flex flex-col ${mo.is_current ? "border-brand-200 ring-1 ring-brand-100" : ""} ${count === 0 ? "opacity-70" : ""}`}
                >
                  <header className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold tabular-nums shrink-0 ${
                        mo.is_current ? "bg-brand text-white" : "bg-ink-100 text-ink-700"
                      }`}>
                        {String(mo.month).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink-900 truncate">{label}</div>
                        {mo.is_current && <div className="text-[10px] uppercase tracking-wider text-brand-700">{t.calendar.thisMonth}</div>}
                      </div>
                    </div>
                    <span className="text-xs text-ink-500 tabular-nums shrink-0">{t.calendar.itemCount(count)}</span>
                  </header>

                  {count === 0 ? (
                    <div className="px-4 pb-4 text-xs text-ink-400">{t.calendar.emptyMonth}</div>
                  ) : (
                    <ul className="px-2 pb-2 space-y-1">
                      {mo.items.map((it) => <CalendarRow key={`${it.keyword}-${it.peak_month}`} item={it} lang={lang} />)}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CalendarRow({ item, lang }: { item: CalendarItem; lang: string }) {
  const t = useT();
  const months = t.calendar.months;
  const tone = item.action === "write"
    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
    : "bg-brand-50 text-brand-700 border-brand-100";
  return (
    <li className="rounded-lg px-2 py-2 hover:bg-ink-50 transition">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`badge border ${tone}`}>{t.calendar.actions[item.action]}</span>
        <Link href={`/explorer?q=${encodeURIComponent(item.keyword)}`} className="text-sm font-medium text-ink-900 hover:text-brand-700 truncate">
          {item.keyword}
        </Link>
        {!item.primary && <span className="badge badge-down">{t.calendar.secondary}</span>}
        {item.late && <span className="badge badge-hot">{t.calendar.late}</span>}
        {item.score != null && <span className="ml-auto text-[11px] tabular-nums text-ink-500">{t.insights.score} {item.score}</span>}
      </div>
      <div className="text-[11px] text-ink-500 mt-1">
        {t.calendar.peakLine(months[item.peak_month - 1], item.peak_lift_pct)}
        {" · "}
        {item.late
          ? t.calendar.publishNow
          : t.calendar.publishBy(fmtDate(item.publish_by, lang), item.days_left)}
        {item.action === "refresh" && item.best_match_slug && (
          <span className="text-ink-400"> · {item.best_match_slug}</span>
        )}
      </div>
    </li>
  );
}
