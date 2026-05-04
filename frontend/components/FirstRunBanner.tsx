"use client";

import Link from "next/link";
import useSWR from "swr";
import { api, AppSettings } from "@/lib/api";
import { useT } from "@/lib/i18n";

export function FirstRunBanner() {
  const t = useT();
  const { data } = useSWR<{ settings: AppSettings; configured: boolean }>(
    "/api/settings",
    api.fetcher
  );

  if (!data || data.configured) return null;

  return (
    <div className="card card-pad mb-6 border-brand-200 bg-gradient-to-br from-brand-50 to-white">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1">
          <div className="text-xs font-medium text-brand-700 uppercase tracking-wide">{t.firstRun.overline}</div>
          <h2 className="text-lg font-semibold text-ink-900 mt-1">{t.firstRun.title}</h2>
          <p className="text-sm text-ink-700 mt-2">{t.firstRun.description}</p>
          <p className="text-xs text-ink-500 mt-2">{t.firstRun.duration}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/settings/setup" className="btn-primary">
            {t.firstRun.startWizard}
          </Link>
          <Link href="/settings" className="btn-ghost">
            {t.firstRun.manual}
          </Link>
        </div>
      </div>
    </div>
  );
}
