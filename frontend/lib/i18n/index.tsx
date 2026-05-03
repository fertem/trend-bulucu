"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { tr, type Dict } from "./tr";
import { en } from "./en";

export type Lang = "tr" | "en";
const DICTS: Record<Lang, Dict> = { tr, en };
const STORAGE_KEY = "trend-bulucu-lang";

function normalize(raw: string | null | undefined): Lang {
  if (!raw) return "tr";
  const lower = raw.toLowerCase();
  if (lower.startsWith("en")) return "en";
  return "tr";
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
  brandName: string;
  setBrandName: (n: string) => void;
};

const I18nContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("tr");
  const [brandName, setBrandName] = useState<string>("");

  useEffect(() => {
    const cached = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (cached) setLangState(normalize(cached));
    const cachedBrand = typeof window !== "undefined" ? localStorage.getItem("trend-bulucu-brand") : null;
    if (cachedBrand) setBrandName(cachedBrand);

    fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/api/auth/config")
      .then((r) => r.ok ? r.json() : null)
      .catch(() => null);

    const token = typeof window !== "undefined" ? localStorage.getItem("trend-bulucu-token") : null;
    if (token) {
      fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/api/settings", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!data?.settings) return;
          const serverLang = normalize(data.settings.language);
          if (!cached) {
            setLangState(serverLang);
            localStorage.setItem(STORAGE_KEY, serverLang);
          }
          if (data.settings.brand_name) {
            setBrandName(data.settings.brand_name);
            localStorage.setItem("trend-bulucu-brand", data.settings.brand_name);
          }
        })
        .catch(() => {});
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l;
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t: DICTS[lang], brandName, setBrandName }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT(): Dict {
  const ctx = useContext(I18nContext);
  return ctx ? ctx.t : tr;
}

export function useLang() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
