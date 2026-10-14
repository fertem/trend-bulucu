"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

/**
 * Uzun içerikleri (büyük tablolar) belirli bir yüksekliğe kırpar, altına
 * "Tümünü göster / Daralt" butonu koyar. İçerik zaten kısa ise hiçbir şey yapmaz.
 */
export function CollapsibleCard({
  children,
  maxHeight = 420,
  defaultOpen = false,
  storageKey,
}: {
  children: ReactNode;
  maxHeight?: number;
  defaultOpen?: boolean;
  /** verilirse açık/kapalı durumu localStorage'da hatırlanır */
  storageKey?: string;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const v = localStorage.getItem(`collapsible:${storageKey}`);
      if (v === "1") setOpen(true);
      if (v === "0") setOpen(false);
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollHeight > maxHeight + 24);
    check();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [maxHeight, children]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (storageKey) {
      try { localStorage.setItem(`collapsible:${storageKey}`, next ? "1" : "0"); } catch {}
    }
  };

  const clamped = overflowing && !open;

  return (
    <div className="relative">
      <div
        ref={ref}
        style={clamped ? { maxHeight } : undefined}
        className={clamped ? "overflow-hidden" : undefined}
      >
        {children}
      </div>
      {clamped && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent rounded-b-lg" />
      )}
      {overflowing && (
        <div className={`flex justify-center ${clamped ? "-mt-4 relative" : "mt-2"}`}>
          <button onClick={toggle} className="btn-ghost btn-sm shadow-sm bg-white">
            {open ? t.common.showLess : t.common.showAll}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`ml-1 transition-transform ${open ? "rotate-180" : ""}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
