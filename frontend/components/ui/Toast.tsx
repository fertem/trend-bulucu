"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastKind = "success" | "error" | "info" | "warning";

type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  duration: number;
};

type ToastInput = {
  kind?: ToastKind;
  title: string;
  description?: string;
  /** ms; 0 = elle kapatılana kadar kalır */
  duration?: number;
};

type Ctx = {
  push: (t: ToastInput) => number;
  dismiss: (id: number) => void;
  success: (title: string, description?: string) => number;
  error: (title: string, description?: string) => number;
  info: (title: string, description?: string) => number;
  warning: (title: string, description?: string) => number;
};

const ToastContext = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = ++counter.current;
      const duration = input.duration ?? (input.kind === "error" ? 7000 : 4000);
      const toast: Toast = { id, kind: input.kind ?? "info", title: input.title, description: input.description, duration };
      setToasts((prev) => [...prev.slice(-4), toast]);
      if (duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration));
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach((tm) => clearTimeout(tm)); map.clear(); };
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      push,
      dismiss,
      success: (title, description) => push({ kind: "success", title, description }),
      error: (title, description) => push({ kind: "error", title, description }),
      info: (title, description) => push({ kind: "info", title, description }),
      warning: (title, description) => push({ kind: "warning", title, description }),
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Provider dışında çağrılırsa sessizce no-op döner (test / izole render)
    const noop = () => 0;
    return { push: noop, dismiss: () => {}, success: noop, error: noop, info: noop, warning: noop };
  }
  return ctx;
}

const STYLES: Record<ToastKind, { ring: string; icon: ReactNode }> = {
  success: {
    ring: "border-emerald-200",
    icon: (
      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      </span>
    ),
  },
  error: {
    ring: "border-red-200",
    icon: (
      <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </span>
    ),
  },
  warning: {
    ring: "border-amber-200",
    icon: (
      <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
      </span>
    ),
  },
  info: {
    ring: "border-brand-100",
    icon: (
      <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
      </span>
    ),
  },
};

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed z-[100] bottom-4 right-4 left-4 sm:left-auto sm:w-96 flex flex-col gap-2 pointer-events-none"
      role="region"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast pointer-events-auto card ${STYLES[t.kind].ring} shadow-lg p-3 flex items-start gap-3`}
          role={t.kind === "error" ? "alert" : "status"}
        >
          {STYLES[t.kind].icon}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-ink-900 break-words">{t.title}</div>
            {t.description && <div className="text-xs text-ink-500 mt-0.5 break-words">{t.description}</div>}
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="text-ink-400 hover:text-ink-700 shrink-0 -m-1 p-1 rounded"
            aria-label="Kapat"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
