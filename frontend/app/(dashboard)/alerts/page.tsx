"use client";

import useSWR from "swr";
import { api, TrendScore } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TrendTable } from "@/components/TrendTable";

export default function AlertsPage() {
  const { data, isLoading, error } = useSWR<TrendScore[]>("/api/trends/alerts", api.fetcher);

  return (
    <div>
      <PageHeader
        title="Uyarılar"
        subtitle="Son 7 günde önceki haftaya göre %50 ve üzeri büyüyen kelimeler."
      />

      {isLoading && <div className="text-sm text-ink-500">Yükleniyor…</div>}
      {error && <div className="text-sm text-red-600">Hata: {String((error as any).message || error)}</div>}

      {data && (
        <div className="card card-pad">
          {data.length === 0 ? (
            <div className="text-sm text-ink-500 py-6 text-center">
              Şu anda hot uyarı yok. İyi bir denge!
            </div>
          ) : (
            <TrendTable rows={data} />
          )}
        </div>
      )}
    </div>
  );
}
