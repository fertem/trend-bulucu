"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { t, lang, setLang, brandName } = useLang();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await api.login(username, password);
      setToken(r.access_token);
      router.push("/");
    } catch (err: any) {
      setError(err.message || t.login.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-4">
          <div className="segmented w-28" role="group" aria-label="Dil">
            <button onClick={() => setLang("tr")} className={`segmented-item ${lang === "tr" ? "segmented-item-active" : ""}`} aria-pressed={lang === "tr"}>TR</button>
            <button onClick={() => setLang("en")} className={`segmented-item ${lang === "en" ? "segmented-item-active" : ""}`} aria-pressed={lang === "en"}>EN</button>
          </div>
        </div>
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 rounded-xl bg-brand text-white text-xl font-semibold flex items-center justify-center shadow-sm mb-3">
            {(brandName || "Trend Dashboard").trim().charAt(0).toUpperCase() || "T"}
          </div>
          <div className="text-lg font-semibold text-ink-900">{brandName || "Trend Dashboard"}</div>
          <div className="text-sm text-ink-500">{t.nav.panelSubtitle}</div>
        </div>
        <form onSubmit={onSubmit} className="card p-6 space-y-4 shadow-md">
          <div>
            <label className="label block mb-1.5">{t.login.username}</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <label className="label block mb-1.5">{t.login.password}</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? t.login.submitting : t.login.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
