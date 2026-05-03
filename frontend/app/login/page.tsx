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
        <div className="flex justify-end mb-3 gap-1">
          <button
            onClick={() => setLang("tr")}
            className={`px-2 py-1 rounded-md text-xs ${lang === "tr" ? "bg-brand-50 text-brand-700 border border-brand-100" : "bg-white text-ink-500 border border-ink-200"}`}
          >🇹🇷 TR</button>
          <button
            onClick={() => setLang("en")}
            className={`px-2 py-1 rounded-md text-xs ${lang === "en" ? "bg-brand-50 text-brand-700 border border-brand-100" : "bg-white text-ink-500 border border-ink-200"}`}
          >🇺🇸 EN</button>
        </div>
        <div className="text-center mb-8">
          <div className="text-lg font-semibold text-ink-900">{brandName || "Trend Dashboard"}</div>
          <div className="text-sm text-ink-500">{t.nav.panelSubtitle}</div>
        </div>
        <form onSubmit={onSubmit} className="card card-pad space-y-4">
          <div>
            <label className="label block mb-1.5">{t.login.username}</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <label className="label block mb-1.5">{t.login.password}</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? t.login.submitting : t.login.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
