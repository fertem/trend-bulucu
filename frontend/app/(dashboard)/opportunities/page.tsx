"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, OpportunitiesV2Response, OpportunityV2 } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { OpportunityCard } from "@/components/OpportunityCard";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/icons";
import { useT } from "@/lib/i18n";

type Filter = "all" | OpportunityV2["action"];
const FILTERS: Filter[] = ["all", "write", "optimize", "maintain", "watch", "track"];

export default function OpportunitiesPage() {
  const t = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading, error, mutate } = useSWR<OpportunitiesV2Response>(
    `/api/insights/opportunities?limit=60${filter !== "all" ? `&action=${filter}` : ""}`,
    api.fetcher,
  );

  const refresh = async () => {
    await api.refreshInsights().catch(() => {});
    mutate();
  };

  return (
    <div>
      <PageHeader
        title={t.opportunities.title}
        subtitle={t.insights.subtitle}
        actions={
          <button className="btn-ghost btn-sm" onClick={refresh}>
            <Icon.Refresh size={14} />
            {t.common.refresh}
          </button>
        }
      />

      <div className="flex flex-wrap gap-1.5 mb-5">
        {FILTERS.map((f) => {
          const count = f === "all" ? data?.total : data?.action_counts?.[f];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn-ghost btn-sm ${filter === f ? "border-brand-200 bg-brand-50 text-brand-700" : ""}`}
            >
              {f === "all" ? t.common.all : t.insights.actions[f]}
              {typeof count === "number" && <span className="text-[10px] tabular-nums opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="card card-pad mb-5 text-xs text-ink-500">
        <span className="font-medium text-ink-700">{t.insights.howTitle}</span> {t.insights.howText}
      </div>

      {isLoading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard lines={5} /><SkeletonCard lines={5} /><SkeletonCard lines={5} /><SkeletonCard lines={5} />
        </div>
      )}
      {error && <div className="text-sm text-red-600">{t.common.error}: {String((error as any).message || error)}</div>}

      {data && data.items.length === 0 && (
        <section className="card"><EmptyState title={t.opportunities.noScore} action={{ label: t.nav.admin, href: "/admin" }} /></section>
      )}

      {data && data.items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.items.map((item) => <OpportunityCard key={item.keyword} item={item} />)}
        </div>
      )}
    </div>
  );
}
