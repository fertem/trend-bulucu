"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, TopicCluster, AuthorityScore, CannibalItem } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";

type Tab = "clusters" | "authority" | "cannibal";

export default function SEOPage() {
  const [tab, setTab] = useState<Tab>("clusters");

  return (
    <div>
      <PageHeader
        title="🎯 SEO Derinliği"
        subtitle="Topic Cluster + Authority + Cannibalization analizleri"
      />

      <div className="flex gap-1 mb-6 border-b border-ink-200 pb-2">
        {(["clusters", "authority", "cannibal"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm px-4 py-2 rounded-md ${
              tab === t ? "bg-brand-50 text-brand-700 font-medium" : "text-ink-700 hover:bg-ink-50"
            }`}
          >
            {t === "clusters" ? "Topic Clusters" : t === "authority" ? "Authority Score" : "Cannibalization"}
          </button>
        ))}
      </div>

      {tab === "clusters" && <ClustersTab />}
      {tab === "authority" && <AuthorityTab />}
      {tab === "cannibal" && <CannibalTab />}
    </div>
  );
}

function ClustersTab() {
  const { data, mutate } = useSWR<{ clusters: TopicCluster[] }>("/api/ai/clusters", api.fetcher);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const build = async () => {
    setBuilding(true);
    setError(null);
    try {
      await api.buildClusters();
      mutate();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBuilding(false);
    }
  };

  const clusters = data?.clusters ?? [];

  return (
    <div>
      <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
        <p className="text-sm text-ink-500 max-w-2xl">
          AI takip kelimelerinizi semantik olarak gruplar. Bir cluster'da yoğunlaşan kelimeler = potansiyel topic authority.
        </p>
        <button className="btn-primary text-sm" onClick={build} disabled={building}>
          {building ? "AI çalışıyor…" : clusters.length === 0 ? "Cluster Oluştur" : "Yeniden Oluştur"}
        </button>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

      {clusters.length === 0 && !building && (
        <div className="card card-pad text-sm text-ink-500">
          Henüz cluster yok. Yukarıdaki butonla AI'a kümeleme yaptır.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clusters.map((c) => (
          <div key={c.name} className="card card-pad">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-medium text-ink-900">{c.name}</h3>
              <span className="badge badge-cat">{c.size} kelime</span>
            </div>
            {c.theme && <p className="text-xs text-ink-500 mb-3 italic">"{c.theme}"</p>}
            <div className="flex flex-wrap gap-1.5">
              {c.keywords.map((k) => (
                <a
                  key={k}
                  href={`/explorer?q=${encodeURIComponent(k)}`}
                  className="text-xs px-2 py-0.5 rounded bg-ink-100 hover:bg-brand-100 hover:text-brand-700"
                >
                  {k}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthorityTab() {
  const { data } = useSWR<{ clusters: AuthorityScore[]; message?: string }>("/api/ai/topic-authority", api.fetcher);

  if (!data) return <div className="text-sm text-ink-500">Yükleniyor…</div>;
  if (data.message) return <div className="card card-pad text-sm text-ink-500">{data.message}</div>;

  const verdictColor = (v: string) => v === "strong" ? "text-emerald-700" : v === "medium" ? "text-amber-700" : "text-red-600";
  const verdictLabel = (v: string) => v === "strong" ? "Güçlü" : v === "medium" ? "Orta" : "Zayıf";

  return (
    <div>
      <p className="text-sm text-ink-500 mb-4 max-w-2xl">
        Her cluster için authority skoru: kelime kapsama × ranking gücü. Strong = bu konuda Google sana güveniyor.
      </p>

      <div className="space-y-3">
        {(data.clusters || []).map((c) => (
          <div key={c.cluster} className="card card-pad">
            <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-medium text-ink-900">{c.cluster}</h3>
                {c.theme && <p className="text-xs text-ink-500 mt-0.5">{c.theme}</p>}
              </div>
              <div className="text-right">
                <div className={`text-2xl font-semibold ${verdictColor(c.verdict)} tabular-nums`}>
                  {c.authority_score}
                </div>
                <div className={`text-xs ${verdictColor(c.verdict)}`}>{verdictLabel(c.verdict)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Stat label="Kelime sayısı" value={c.size.toString()} />
              <Stat label="Kapsanan" value={`${c.covered}/${c.size} (%${c.coverage_pct.toFixed(0)})`} />
              <Stat label="Ortalama pozisyon" value={c.avg_position?.toFixed(1) ?? "—"} />
              <Stat label="Toplam tıklama (28g)" value={c.total_clicks.toString()} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CannibalTab() {
  const { data } = useSWR<{ items: CannibalItem[]; message?: string }>("/api/ai/cannibalization", api.fetcher);

  if (!data) return <div className="text-sm text-ink-500">Yükleniyor…</div>;
  if (data.message) return <div className="card card-pad text-sm text-ink-500">{data.message}</div>;

  const items = data.items || [];

  return (
    <div>
      <p className="text-sm text-ink-500 mb-4 max-w-2xl">
        Aynı sorgu için birden fazla sayfan ranking yapıyorsa, sayfalar birbirini kannibalize eder (Google hangisini öne çıkartacağını bilemez).
        Çözüm: tek "ana" sayfaya odaklan, diğerlerini canonicalize et veya birleştir.
      </p>

      {items.length === 0 ? (
        <div className="card card-pad text-sm text-emerald-700">
          ✓ Cannibalization yok — temiz! Aynı sorgu için tek sayfa ranking yapıyor.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((it, i) => (
            <div key={i} className={`card card-pad ${it.severity === "high" ? "border-red-100 bg-red-50/30" : "border-amber-100 bg-amber-50/30"}`}>
              <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-medium text-ink-900">"{it.query}"</h3>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {it.page_count} sayfa rekabet ediyor · {it.total_impressions} gösterim · {it.total_clicks} klik
                  </p>
                </div>
                <span className={`badge ${it.severity === "high" ? "badge-hot" : "bg-amber-50 text-amber-700 border-amber-100"}`}>
                  {it.severity === "high" ? "🔴 Yüksek" : "🟡 Orta"}
                </span>
              </div>
              <div className="space-y-1">
                {it.pages.map((p, j) => (
                  <div key={j} className={`flex items-center justify-between p-2 rounded ${j === 0 ? "bg-emerald-50/50 border border-emerald-100" : "bg-white border border-ink-100"}`}>
                    <a href={p.page} target="_blank" rel="noreferrer" className="text-xs text-ink-700 hover:underline truncate flex-1">
                      {j === 0 && "✓ "}
                      {p.page.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                    <div className="text-xs text-ink-500 tabular-nums shrink-0 ml-2">
                      pos {p.position.toFixed(1)} · {p.clicks} klik
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-500">{label}</div>
      <div className="text-base font-medium text-ink-900 tabular-nums">{value}</div>
    </div>
  );
}
