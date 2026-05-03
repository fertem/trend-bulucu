"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, SetupStatus, SetupStep } from "@/lib/api";

const DISMISS_KEY = "setup-checklist-dismissed";

export function SetupChecklist({ alwaysShow = false }: { alwaysShow?: boolean }) {
  const { data } = useSWR<SetupStatus>("/api/system/setup-status", api.fetcher, {
    refreshInterval: 30_000, // her 30 sn'de tazele (kullanıcı setup yaparken)
  });
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(DISMISS_KEY);
      setDismissed(v === "1");
    } catch {}
  }, []);

  if (!data) return null;

  // Eğer tamamen kuruluysa ve kullanıcı reddetmişse, gösterme (alwaysShow değilse)
  if (!alwaysShow && data.fully_setup && dismissed) return null;

  const totalSteps = data.required_total + data.optional_total;
  const totalDone = data.required_done + data.optional_done;
  const requiredPct = (data.required_done / data.required_total) * 100;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <section className="card card-pad mb-6 border-brand-100 bg-gradient-to-br from-brand-50/40 to-white">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-brand-700 uppercase tracking-wide">Kurulum Rehberi</span>
            {data.fully_setup ? (
              <span className="badge badge-up">✓ Zorunlu adımlar tamam</span>
            ) : (
              <span className="badge badge-cat">{data.required_done}/{data.required_total} zorunlu</span>
            )}
          </div>
          <h2 className="text-lg font-semibold text-ink-900 mt-1">
            {data.fully_setup
              ? "🎉 Sistem hazır — opsiyonel entegrasyonlarla daha güçlü hale getir"
              : "🪄 Kurulumunu tamamla"}
          </h2>
          <p className="text-xs text-ink-500 mt-1">
            {totalDone}/{totalSteps} adım tamamlandı · zorunlu olanlar bitince panel tam çalışır
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs px-2 py-1 rounded text-ink-500 hover:bg-ink-100"
          >
            {collapsed ? "▾ Detayı aç" : "▴ Kapat"}
          </button>
          {data.fully_setup && (
            <button
              onClick={dismiss}
              className="text-xs px-2 py-1 rounded text-ink-500 hover:bg-ink-100"
              title="Bu rehberi gizle"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* İlerleme çubuğu */}
      <div className="h-2 bg-ink-100 rounded overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all"
          style={{ width: `${requiredPct}%` }}
        />
      </div>

      {!collapsed && (
        <>
          <div className="space-y-2">
            <SectionHeader title="Zorunlu Adımlar" count={`${data.required_done}/${data.required_total}`} />
            {data.steps.filter((s) => s.required).map((step, i) => (
              <StepRow key={step.id} step={step} index={i + 1} />
            ))}
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-ink-100">
            <SectionHeader title="Opsiyonel Entegrasyonlar" count={`${data.optional_done}/${data.optional_total}`} />
            <p className="text-xs text-ink-500 mb-2">
              Bunlar zorunlu değil ama tamamlayınca panel çok daha güçlü çalışır.
            </p>
            {data.steps.filter((s) => !s.required).map((step, i) => (
              <StepRow key={step.id} step={step} index={i + 1 + data.required_total} />
            ))}
          </div>

          {data.fully_setup && (
            <div className="mt-4 pt-3 border-t border-emerald-100">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-emerald-700 font-medium">
                  ✓ Tüm zorunlu adımlar tamamlandı. Sistem aktif!
                </p>
                <button onClick={dismiss} className="btn-ghost text-xs">
                  Rehberi Gizle
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function SectionHeader({ title, count }: { title: string; count: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-xs font-medium text-ink-500 uppercase tracking-wide">{title}</div>
      <div className="text-xs text-ink-500 tabular-nums">{count}</div>
    </div>
  );
}

function StepRow({ step, index }: { step: SetupStep; index: number }) {
  const counter = step.current_count !== undefined && step.target_count !== undefined
    ? ` (${step.current_count}/${step.target_count})`
    : "";

  return (
    <div className={`flex items-start gap-3 p-3 rounded-md border transition ${
      step.done
        ? "border-emerald-100 bg-emerald-50/30"
        : step.required
          ? "border-brand-100 bg-white"
          : "border-ink-100 bg-white"
    }`}>
      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
        step.done
          ? "bg-emerald-500 text-white"
          : "bg-ink-100 text-ink-500"
      }`}>
        {step.done ? "✓" : index}
      </div>

      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${step.done ? "text-ink-500 line-through" : "text-ink-900"}`}>
          {step.title}{counter}
        </div>
        <div className="text-xs text-ink-500 mt-0.5">{step.description}</div>
        {step.doc_link && (
          <a
            href={step.doc_link}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-700 hover:underline inline-block mt-1"
          >
            📖 Detaylı rehber
          </a>
        )}
      </div>

      {!step.done && (
        <Link
          href={step.action_url}
          className={`text-xs px-3 py-1.5 rounded-md whitespace-nowrap shrink-0 ${
            step.required
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "border border-ink-200 text-ink-700 hover:bg-ink-50"
          }`}
        >
          {step.action_label}
        </Link>
      )}
    </div>
  );
}
