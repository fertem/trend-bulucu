"use client";

import Link from "next/link";
import useSWR from "swr";
import { api, AppSettings } from "@/lib/api";

export function FirstRunBanner() {
  const { data } = useSWR<{ settings: AppSettings; configured: boolean }>(
    "/api/settings",
    api.fetcher
  );

  if (!data || data.configured) return null;

  return (
    <div className="card card-pad mb-6 border-brand-200 bg-gradient-to-br from-brand-50 to-white">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1">
          <div className="text-xs font-medium text-brand-700 uppercase tracking-wide">İlk Kurulum</div>
          <h2 className="text-lg font-semibold text-ink-900 mt-1">
            🪄 Markana özel hızlı kurulum sihirbazı
          </h2>
          <p className="text-sm text-ink-700 mt-2">
            5 adımda marka bilgilerini gir, AI sektörünü tespit etsin, sana uygun kategori ve tohum kelime önersin.
            Sonra "Tümünü Güncelle" ile ilk veri çekimini yapacağız.
          </p>
          <p className="text-xs text-ink-500 mt-2">
            Tahmini süre: ~5 dakika. AI önerileri için OpenAI veya Claude API anahtarın olmalı (Ayarlar → API).
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/settings/setup" className="btn-primary">
            Sihirbazı Başlat
          </Link>
          <Link href="/settings" className="btn-ghost">
            Manuel Kur
          </Link>
        </div>
      </div>
    </div>
  );
}
