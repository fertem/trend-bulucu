"use client";

import Link from "next/link";
import { OpportunityV2 } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { GrowthBadge } from "./GrowthBadge";

const ACTION_TONE: Record<OpportunityV2["action"], string> = {
  write: "bg-emerald-50 text-emerald-700 border-emerald-100",
  optimize: "bg-brand-50 text-brand-700 border-brand-100",
  maintain: "bg-ink-100 text-ink-700 border-ink-200",
  watch: "bg-red-50 text-red-700 border-red-100",
  track: "bg-ink-100 text-ink-500 border-ink-200",
};

const COMPONENT_ORDER: (keyof OpportunityV2["components"])[] = ["momentum", "demand", "seo", "coverage", "seasonality"];
const COMPONENT_COLOR: Record<string, string> = {
  momentum: "bg-brand-500",
  demand: "bg-purple-500",
  seo: "bg-amber-500",
  coverage: "bg-emerald-500",
  seasonality: "bg-cyan-500",
};

function scoreTone(score: number) {
  if (score >= 70) return "text-emerald-700";
  if (score >= 45) return "text-amber-700";
  return "text-ink-500";
}

export function OpportunityCard({ item }: { item: OpportunityV2 }) {
  const t = useT();
  const total = COMPONENT_ORDER.reduce((s, k) => s + item.components[k].max, 0);

  return (
    <div className="card card-pad hover:border-brand-200 transition">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <Link href={`/explorer?q=${encodeURIComponent(item.keyword)}`} className="font-medium text-ink-900 hover:text-brand-700 block truncate">
            {item.keyword}
          </Link>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`badge border ${ACTION_TONE[item.action]}`}>{t.insights.actions[item.action]}</span>
            {item.category && <span className="badge badge-cat">{item.category}</span>}
            <GrowthBadge pct={item.metrics.growth_pct} hot={item.is_hot} />
            {item.confidence !== "high" && (
              <span className="badge badge-down" title={t.insights.confidenceHint}>
                {t.insights.confidence[item.confidence]}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-3xl font-semibold tabular-nums leading-none ${scoreTone(item.score)}`}>{item.score}</div>
          <div className="text-[10px] uppercase tracking-wider text-ink-400 mt-1">{t.insights.score}</div>
        </div>
      </div>

      {/* Bileşen çubuğu */}
      <div className="flex h-2 rounded-full overflow-hidden bg-ink-100" title={t.insights.breakdown}>
        {COMPONENT_ORDER.map((k) => {
          const c = item.components[k];
          const pct = (c.value / total) * 100;
          return pct > 0 ? <div key={k} className={COMPONENT_COLOR[k]} style={{ width: `${pct}%` }} title={`${t.insights.components[k]}: ${c.value}/${c.max}`} /> : null;
        })}
      </div>
      <div className="grid grid-cols-5 gap-1 mt-1.5">
        {COMPONENT_ORDER.map((k) => (
          <div key={k} className="text-[10px] text-ink-500 leading-tight">
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle ${COMPONENT_COLOR[k]}`} />
            {t.insights.components[k]}
            <span className="block tabular-nums text-ink-700">{item.components[k].value}/{item.components[k].max}</span>
          </div>
        ))}
      </div>

      {/* Nedenler */}
      {item.reasons.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {item.reasons.map((r, i) => {
            const fmt = (t.insights.reasons as Record<string, string | ((p: any) => string)>)[r.code];
            const text = typeof fmt === "function" ? fmt(r.params) : fmt ?? r.code;
            const neg = ["growth_down", "low_interest", "no_data", "stale_data", "off_season", "sc_absent"].includes(r.code);
            return (
              <li key={i} className={`text-[11px] px-2 py-0.5 rounded-md border ${neg ? "bg-ink-50 text-ink-500 border-ink-200" : "bg-surface text-ink-700 border-ink-200"}`}>
                {text}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
