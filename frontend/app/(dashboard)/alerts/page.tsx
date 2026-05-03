"use client";

import useSWR from "swr";
import { api, TrendScore } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TrendTable } from "@/components/TrendTable";
import { useT } from "@/lib/i18n";

export default function AlertsPage() {
  const t = useT();
  const { data, isLoading, error } = useSWR<TrendScore[]>("/api/trends/alerts", api.fetcher);

  return (
    <div>
      <PageHeader
        title={t.alerts.title}
        subtitle={t.alerts.subtitle}
      />

      {isLoading && <div className="text-sm text-ink-500">{t.common.loading}</div>}
      {error && <div className="text-sm text-red-600">{t.common.error}: {String((error as any).message || error)}</div>}

      {data && (
        <div className="card card-pad">
          {data.length === 0 ? (
            <div className="text-sm text-ink-500 py-6 text-center">
              {t.alerts.noAlerts}
            </div>
          ) : (
            <TrendTable rows={data} />
          )}
        </div>
      )}
    </div>
  );
}
