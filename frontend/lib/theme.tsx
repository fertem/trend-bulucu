"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePref = "system" | "light" | "dark";
export type Resolved = "light" | "dark";

export const THEME_STORAGE_KEY = "trend-bulucu-theme";

/**
 * İlk boyamada "flash of light theme" olmaması için <head> içine inline gömülen script.
 * localStorage'daki tercihi (veya sistem tercihini) okuyup <html>'e "dark" sınıfını uygular.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}";var p=localStorage.getItem(k);var d=p==="dark"||((!p||p==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);var c=document.documentElement.classList;d?c.add("dark"):c.remove("dark");document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

type Ctx = {
  pref: ThemePref;
  resolved: Resolved;
  setPref: (p: ThemePref) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {}
  return "system";
}

function systemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(resolved: Resolved) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [resolved, setResolved] = useState<Resolved>("light");

  // İlk yükleme: tercihi ve gerçek durumu oku (inline script zaten sınıfı uygulamış olabilir)
  useEffect(() => {
    const p = readPref();
    setPrefState(p);
    const r: Resolved = p === "system" ? (systemDark() ? "dark" : "light") : p;
    setResolved(r);
    apply(r);
  }, []);

  // Sistem tercihi değişirse ve kullanıcı "system" seçtiyse takip et
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r: Resolved = mq.matches ? "dark" : "light";
      setResolved(r);
      apply(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try { localStorage.setItem(THEME_STORAGE_KEY, p); } catch {}
    const r: Resolved = p === "system" ? (systemDark() ? "dark" : "light") : p;
    setResolved(r);
    apply(r);
  }, []);

  const value = useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { pref: "system", resolved: "light", setPref: () => {} };
  return ctx;
}

/** Recharts gibi CSS sınıfı almayan kütüphaneler için tema renkleri. */
export function useChartTheme() {
  const { resolved } = useTheme();
  return useMemo(
    () =>
      resolved === "dark"
        ? {
            grid: "#334155",      // slate-700
            axis: "#94a3b8",      // slate-400
            text: "#e2e8f0",      // slate-200
            muted: "#64748b",     // slate-500
            surface: "#0f172a",   // slate-900
            border: "#334155",
            tooltip: {
              contentStyle: { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 12 },
              labelStyle: { color: "#e2e8f0" },
              itemStyle: { color: "#e2e8f0" },
            },
          }
        : {
            grid: "#e2e8f0",
            axis: "#94a3b8",
            text: "#0f172a",
            muted: "#64748b",
            surface: "#ffffff",
            border: "#e2e8f0",
            tooltip: {
              contentStyle: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#0f172a", fontSize: 12 },
              labelStyle: { color: "#0f172a" },
              itemStyle: { color: "#0f172a" },
            },
          },
    [resolved],
  );
}
