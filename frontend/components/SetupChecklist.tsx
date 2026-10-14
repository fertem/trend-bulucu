"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, SetupStatus, SetupStep } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Icon } from "./icons";

const DISMISS_KEY = "setup-checklist-dismissed";

/**
 * Kurulum rehberi.
 * - Zorunlu adımlar bitmemişse: tam kart (adım listesi).
 * - Bitmişse: tek satırlık ince bir "hazır" şeridi; istenirse açılır.
 * - alwaysShow: Kurulum sayfasında her zaman tam kart.
 */
export function SetupChecklist({ alwaysShow = false }: { alwaysShow?: boolean }) {
  const t = useT();
  const { data } = useSWR<SetupStatus>("/api/system/setup-status", api.fetcher, {
    refreshInterval: 30_000,
  });
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(DISMISS_KEY);
      setDismissed(v === "1");
    } catch {}
  }, []);

  if (!data) return null;
  if (!alwaysShow && data.fully_setup && dismissed) return null;

  const totalSteps = data.required_total + data.optional_total;
  const totalDone = data.required_done + data.optional_done;
  const requiredPct = (data.required_done / data.required_total) * 100;
  const allOptionalDone = data.optional_done >= data.optional_total;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

  // ── Kompakt şerit: kurulum bitmiş, kullanıcı detay istememiş ─────────────
  if (!alwaysShow && data.fully_setup && !expanded) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-2.5">
        <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
          <Icon.Check size={13} strokeWidth={3} />
        </span>
        <div className="flex-1 min-w-0 text-sm text-emerald-800 line-clamp-2 sm:line-clamp-none sm:truncate">
          {allOptionalDone ? t.setup.compactReady : t.setup.compactReadyPartial(data.optional_done, data.optional_total)}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setExpanded(true)} className="text-xs text-emerald-800 hover:underline px-2 py-1">
            {t.setup.showGuide}
          </button>
          <button
            onClick={dismiss}
            className="text-emerald-700/70 hover:text-emerald-900 p-1 rounded"
            title={t.setup.hide}
            aria-label={t.setup.hide}
          >
            <Icon.Close size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="card card-pad mb-6 border-brand-100 bg-gradient-to-br from-brand-50/40 to-surface">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="overline text-brand-700">{t.setup.overline}</span>
            {data.fully_setup ? (
              <span className="badge badge-up">{t.setup.requiredDone}</span>
            ) : (
              <span className="badge badge-cat">{t.setup.requiredCount(data.required_done, data.required_total)}</span>
            )}
          </div>
          <h2 className="text-lg font-semibold text-ink-900 mt-1">
            {data.fully_setup ? t.setup.titleReady : t.setup.titleSetup}
          </h2>
          <p className="text-xs text-ink-500 mt-1">{t.setup.progress(totalDone, totalSteps)}</p>
        </div>
        {!alwaysShow && data.fully_setup && (
          <div className="flex gap-1">
            <button onClick={() => setExpanded(false)} className="btn-ghost btn-sm">
              {t.setup.collapse}
            </button>
            <button
              onClick={dismiss}
              className="btn-ghost btn-sm"
              title={t.setup.hide}
              aria-label={t.setup.hide}
            >
              <Icon.Close size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="h-2 bg-ink-100 rounded overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all"
          style={{ width: `${requiredPct}%` }}
        />
      </div>

      <div className="space-y-2">
        <SectionHeader title={t.setup.required} count={`${data.required_done}/${data.required_total}`} />
        {data.steps.filter((s) => s.required).map((step, i) => (
          <StepRow key={step.id} step={step} index={i + 1} />
        ))}
      </div>

      <div className="space-y-2 mt-4 pt-4 border-t border-ink-100">
        <SectionHeader title={t.setup.optional} count={`${data.optional_done}/${data.optional_total}`} />
        <p className="text-xs text-ink-500 mb-2">{t.setup.optionalHint}</p>
        {data.steps.filter((s) => !s.required).map((step, i) => (
          <StepRow key={step.id} step={step} index={i + 1 + data.required_total} />
        ))}
      </div>

      {data.fully_setup && !alwaysShow && (
        <div className="mt-4 pt-3 border-t border-emerald-100">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-emerald-700 font-medium">{t.setup.fullyReady}</p>
            <button onClick={dismiss} className="btn-ghost btn-sm">
              {t.setup.hideGuide}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SectionHeader({ title, count }: { title: string; count: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="overline">{title}</div>
      <div className="text-xs text-ink-500 tabular-nums">{count}</div>
    </div>
  );
}

function StepRow({ step, index }: { step: SetupStep; index: number }) {
  const t = useT();
  const counter = step.current_count !== undefined && step.target_count !== undefined
    ? ` (${step.current_count}/${step.target_count})`
    : "";

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition ${
      step.done
        ? "border-emerald-100 bg-emerald-50/30"
        : step.required
          ? "border-brand-100 bg-surface"
          : "border-ink-100 bg-surface"
    }`}>
      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
        step.done
          ? "bg-emerald-500 text-white"
          : "bg-ink-100 text-ink-500"
      }`}>
        {step.done ? <Icon.Check size={13} strokeWidth={3} /> : index}
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
            {t.setup.detailedGuide}
          </a>
        )}
      </div>

      {!step.done && (
        <Link
          href={step.action_url}
          className={`${step.required ? "btn-primary" : "btn-ghost"} btn-sm whitespace-nowrap shrink-0`}
        >
          {step.action_label}
        </Link>
      )}
    </div>
  );
}
