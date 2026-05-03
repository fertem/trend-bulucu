"use client";

import useSWR from "swr";
import { api, TrendScore } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TrendTable } from "@/components/TrendTable";
import { useT, useLang } from "@/lib/i18n";

export default function CategoriesPage() {
  const t = useT();
  const { lang } = useLang();
  const { data, isLoading, error } = useSWR<Record<string, TrendScore[]>>(
    "/api/trends/categories",
    api.fetcher
  );

  return (
    <div>
      <PageHeader
        title={t.categories.title}
        subtitle={t.categories.subtitle}
      />

      {isLoading && <div className="text-sm text-ink-500">{t.common.loading}</div>}
      {error && <div className="text-sm text-red-600">{t.common.error}: {String((error as any).message || error)}</div>}

      {data && Object.keys(data).length === 0 && (
        <div className="text-sm text-ink-500">{t.common.noData}</div>
      )}

      {data && (
        <div className="space-y-6">
          {Object.entries(data)
            .sort(([a], [b]) => a.localeCompare(b, lang))
            .map(([cat, rows]) => (
              <section key={cat} className="card card-pad">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-medium text-ink-900">{cat}</h2>
                  <span className="text-xs text-ink-500">{rows.length} {lang === "en" ? "keywords" : "kelime"}</span>
                </div>
                <TrendTable rows={rows} showCategory={false} />
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
