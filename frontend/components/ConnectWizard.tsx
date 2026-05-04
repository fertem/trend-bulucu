"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

type Status = {
  client_id_set: boolean;
  client_secret_set: boolean;
  refresh_token_set: boolean;
  redirect_uri: string;
};

export function ConnectWizard({ onConnected }: { onConnected?: () => void }) {
  const t = useT();
  const [status, setStatus] = useState<Status | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sites, setSites] = useState<{ url: string; permission: string }[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const s = await api.oauthStatus();
      setStatus(s);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  // Listen for postMessage from OAuth callback popup
  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      if (!ev.data || ev.data.type !== "oauth-result") return;
      setConnecting(false);
      if (ev.data.success) {
        setSuccess(t.settings.connect.success);
        setError(null);
        refresh();
        loadSites();
        onConnected?.();
      } else {
        setError(ev.data.message || "OAuth failed");
        setSuccess(null);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSites = async () => {
    try {
      const r = await api.scListSites();
      setSites(r.sites);
    } catch (e: any) {
      // 502 if no auth yet — silent
      setSites(null);
    }
  };

  // Auto-load sites if already connected
  useEffect(() => {
    if (status?.refresh_token_set && !sites) {
      loadSites();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.refresh_token_set]);

  const saveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setSavingCreds(true);
    setError(null);
    try {
      await api.oauthSaveCredentials(clientId.trim(), clientSecret.trim());
      setClientId("");
      setClientSecret("");
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingCreds(false);
    }
  };

  const startOAuth = async () => {
    setConnecting(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await api.oauthStart();
      const popup = window.open(r.auth_url, "oauth", "width=600,height=700,left=200,top=100");
      if (!popup || popup.closed) {
        setConnecting(false);
        setError(t.settings.connect.popupBlocked);
      }
      // Wait for postMessage handler to fire — connecting stays true until then
    } catch (e: any) {
      setConnecting(false);
      setError(e.message);
    }
  };

  const pickSite = async (url: string) => {
    setPicked(url);
    try {
      await api.scSetSite(url);
      onConnected?.();
    } catch (e: any) {
      setError(e.message);
      setPicked(null);
    }
  };

  if (!status) {
    return <div className="card card-pad text-sm text-ink-500">…</div>;
  }

  const credentialsOk = status.client_id_set && status.client_secret_set;
  const fullyConnected = credentialsOk && status.refresh_token_set;

  return (
    <div className="card card-pad space-y-4 border-cyan-100 bg-gradient-to-br from-cyan-50/30 to-white">
      <div>
        <h3 className="font-medium text-ink-900">{t.settings.connect.title}</h3>
        <p className="text-xs text-ink-500 mt-1">{t.settings.connect.subtitle}</p>
      </div>

      {fullyConnected && (
        <div className="text-sm text-emerald-700 p-2 bg-emerald-50 border border-emerald-100 rounded">
          {t.settings.connect.already}
        </div>
      )}

      {success && !fullyConnected && (
        <div className="text-sm text-emerald-700 p-2 bg-emerald-50 border border-emerald-100 rounded">
          {success}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 p-2 bg-red-50 border border-red-100 rounded">
          {t.settings.connect.error}: {error}
        </div>
      )}

      {/* Step 1 — Always visible (instructions) */}
      <details className="rounded-md border border-ink-200 p-3 bg-white" open={!credentialsOk}>
        <summary className="cursor-pointer text-sm font-medium text-ink-900">
          {t.settings.connect.step1}
        </summary>
        <div className="mt-2 text-xs text-ink-700 space-y-2">
          <p>{t.settings.connect.step1Hint}</p>
          <p>{t.settings.connect.step1Redirect}</p>
          <code className="block bg-ink-100 px-2 py-1.5 rounded font-mono text-xs break-all">
            {status.redirect_uri}
          </code>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
            className="inline-block text-cyan-700 hover:underline"
          >
            {t.settings.connect.step1OpenConsole}
          </a>
        </div>
      </details>

      {/* Step 2 — Show form if credentials not set, just a confirmation if they are */}
      {!credentialsOk ? (
        <div className="rounded-md border border-ink-200 p-3 bg-white space-y-3">
          <div className="text-sm font-medium text-ink-900">{t.settings.connect.step2}</div>
          <div>
            <label className="label block mb-1">{t.settings.connect.clientId}</label>
            <input
              className="input font-mono text-xs"
              placeholder={t.settings.connect.clientIdPh}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <div>
            <label className="label block mb-1">{t.settings.connect.clientSecret}</label>
            <input
              type="password"
              className="input font-mono text-xs"
              placeholder={t.settings.connect.clientSecretPh}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>
          <button
            className="btn-primary text-sm"
            onClick={saveCredentials}
            disabled={savingCreds || !clientId.trim() || !clientSecret.trim()}
          >
            {savingCreds ? t.settings.connect.saving : t.settings.connect.saveCredentials}
          </button>
        </div>
      ) : (
        <div className="text-xs text-ink-500 px-1">
          ✓ Client ID + Secret kayıtlı
        </div>
      )}

      {/* Step 3 — OAuth button */}
      {credentialsOk && (
        <div className="rounded-md border border-ink-200 p-3 bg-white space-y-2">
          <div className="text-sm font-medium text-ink-900">{t.settings.connect.step3}</div>
          <button
            className={`text-sm px-4 py-2 rounded-md ${
              fullyConnected ? "border border-ink-200 text-ink-700 hover:bg-ink-50" : "bg-cyan-600 text-white hover:bg-cyan-700"
            }`}
            onClick={startOAuth}
            disabled={connecting}
          >
            {connecting ? t.settings.connect.connecting :
             fullyConnected ? t.settings.connect.reconnect :
             t.settings.connect.connectBtn}
          </button>
        </div>
      )}

      {/* Site picker */}
      {sites && sites.length > 0 && (
        <div className="rounded-md border border-ink-200 p-3 bg-white space-y-2">
          <div className="text-sm font-medium text-ink-900">{t.settings.connect.pickSite}</div>
          {sites.map((s) => (
            <button
              key={s.url}
              onClick={() => pickSite(s.url)}
              disabled={picked !== null}
              className={`w-full text-left p-2 rounded-md border transition ${
                picked === s.url
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-ink-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/30"
              } disabled:opacity-50`}
            >
              <div className="font-medium text-ink-900 text-sm">{s.url}</div>
              <div className="text-xs text-ink-500">izin: {s.permission}</div>
              {picked === s.url && (
                <div className="text-xs text-emerald-700 mt-1">{t.settings.connect.pickedRestart}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
