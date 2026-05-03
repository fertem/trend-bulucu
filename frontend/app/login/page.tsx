"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
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
      setError(err.message || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-lg font-semibold text-ink-900">1e1kod</div>
          <div className="text-sm text-ink-500">Trend Paneli</div>
        </div>
        <form onSubmit={onSubmit} className="card card-pad space-y-4">
          <div>
            <label className="label block mb-1.5">Kullanıcı adı</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <label className="label block mb-1.5">Şifre</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Giriş yapılıyor…" : "Giriş yap"}
          </button>
        </form>
      </div>
    </div>
  );
}
