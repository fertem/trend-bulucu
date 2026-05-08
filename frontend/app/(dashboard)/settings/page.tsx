"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, AppSettings, CategoryItem, EnvItem, UpdateCheckResponse, HealthCheckResponse } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { ConnectWizard } from "@/components/ConnectWizard";
import { useT, useLang } from "@/lib/i18n";

type Tab = "brand" | "api" | "connect" | "categories" | "site" | "system";

export default function SettingsPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("brand");
  const { data, mutate } = useSWR<{ settings: AppSettings; configured: boolean }>("/api/settings", api.fetcher);
  const settings = data?.settings;

  const TABS: { key: Tab; label: string; emoji: string }[] = [
    { key: "brand", label: t.settings.tabs.brand, emoji: "🏷️" },
    { key: "api", label: t.settings.tabs.api, emoji: "🔑" },
    { key: "connect", label: "Google Bağlantısı", emoji: "🔐" },
    { key: "categories", label: t.settings.tabs.categories, emoji: "📁" },
    { key: "site", label: t.settings.tabs.site, emoji: "🌐" },
    { key: "system", label: t.settings.tabs.system, emoji: "⚙️" },
  ];

  return (
    <div>
      <PageHeader
        title={t.settings.title}
        subtitle={t.settings.subtitle}
        actions={
          !data?.configured ? (
            <Link href="/settings/setup" className="btn-primary">
              {t.settings.quickWizard}
            </Link>
          ) : null
        }
      />

      <HealthCard onJump={(t) => setTab(t)} />

      <div className="flex gap-1 mb-6 flex-wrap border-b border-ink-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm px-4 py-2 rounded-md transition ${
              tab === t.key
                ? "bg-brand-50 text-brand-700 font-medium"
                : "text-ink-700 hover:bg-ink-50"
            }`}
          >
            <span className="mr-1.5">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      {!settings && <div className="text-sm text-ink-500">{t.common.loading}</div>}
      {settings && tab === "brand" && <BrandTab settings={settings} onSave={() => mutate()} />}
      {settings && tab === "api" && <APITab />}
      {settings && tab === "connect" && <ConnectWizard onConnected={() => mutate()} />}
      {settings && tab === "categories" && <CategoriesTab settings={settings} />}
      {settings && tab === "site" && <SiteTab settings={settings} onSave={() => mutate()} />}
      {settings && tab === "system" && <SystemTab settings={settings} onSave={() => mutate()} />}
    </div>
  );
}

function BrandTab({ settings, onSave }: { settings: AppSettings; onSave: () => void }) {
  const t = useT();
  const [form, setForm] = useState({
    brand_name: settings.brand_name,
    brand_url: settings.brand_url,
    brand_description: settings.brand_description,
    target_audience: settings.target_audience,
    industry: settings.industry,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.updateSettings(form);
      setMsg(t.settings.brand.saved);
      onSave();
    } catch (e: any) {
      setMsg(`${t.common.error}: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card card-pad max-w-2xl space-y-4">
      <p className="text-sm text-ink-500">{t.settings.brand.hint}</p>
      <Field label={t.settings.brand.name} value={form.brand_name} onChange={(v) => setForm({ ...form, brand_name: v })} placeholder={t.settings.brand.namePh} />
      <Field label={t.settings.brand.url} value={form.brand_url} onChange={(v) => setForm({ ...form, brand_url: v })} placeholder={t.settings.brand.urlPh} />
      <Field
        label={t.settings.brand.description}
        value={form.brand_description}
        onChange={(v) => setForm({ ...form, brand_description: v })}
        placeholder={t.settings.brand.descriptionPh}
        textarea
      />
      <Field
        label={t.settings.brand.audience}
        value={form.target_audience}
        onChange={(v) => setForm({ ...form, target_audience: v })}
        placeholder={t.settings.brand.audiencePh}
      />
      <Field
        label={t.settings.brand.industry}
        value={form.industry}
        onChange={(v) => setForm({ ...form, industry: v })}
        placeholder={t.settings.brand.industryPh}
      />
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? t.common.saving : t.common.save}
        </button>
        {msg && <span className={`text-sm ${msg.startsWith("✓") ? "text-emerald-700" : "text-red-600"}`}>{msg}</span>}
      </div>
    </div>
  );
}

function APITab() {
  const t = useT();
  const { data, mutate } = useSWR<{ items: Record<string, EnvItem> }>("/api/settings/env", api.fetcher);
  const [updates, setUpdates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!data) return <div className="text-sm text-ink-500">{t.common.loading}</div>;

  const groups: { title: string; keys: string[]; hint?: string }[] = [
    {
      title: t.settings.api.groups.ai,
      keys: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "AI_PROVIDER"],
      hint: t.settings.api.groups.aiHint,
    },
    {
      title: "🔍 Trend Veri Kaynağı (Pytrends fallback)",
      keys: ["SERPAPI_KEY", "APIFY_API_TOKEN"],
      hint: "Pytrends rate-limit yiyince yedek olarak kullanılır. Öncelik: SerpAPI > Apify > Pytrends. SerpAPI free 250/ay, Apify $5 free credit. Boş bırakılırsa sadece Pytrends kullanılır (rate-limit'li).",
    },
    {
      title: t.settings.api.groups.ads,
      keys: [
        "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET",
        "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID",
        "GOOGLE_ADS_LOGIN_CUSTOMER_ID", "GOOGLE_ADS_API_VERSION",
      ],
    },
    {
      title: t.settings.api.groups.sc,
      keys: ["SEARCH_CONSOLE_SITE_URL"],
    },
    {
      title: t.settings.api.groups.pytrends,
      keys: ["PYTRENDS_GEO", "PYTRENDS_HL", "PYTRENDS_TIMEFRAME", "REQUEST_DELAY_SECONDS", "MAX_RETRIES"],
    },
    {
      title: t.settings.api.groups.scheduler,
      keys: ["COLLECT_HOUR", "COLLECT_MINUTE", "TIMEZONE"],
    },
    {
      title: t.settings.api.groups.auth,
      keys: ["ADMIN_PASSWORD", "JWT_SECRET"],
    },
  ];

  const save = async () => {
    if (Object.keys(updates).length === 0) return;
    setSaving(true);
    setMsg(null);
    try {
      const r: any = await api.updateEnv(updates);
      const reloadIcon = r.reloaded ? "✓" : "⚠";
      setMsg(`${reloadIcon} ${r.written.length} ${r.note || ""}`);
      setUpdates({});
      mutate();
    } catch (e: any) {
      setMsg(`${t.common.error}: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card card-pad bg-emerald-50/40 border-emerald-100 text-sm text-emerald-900">
        ✨ <strong>{t.settings.api.autoActive}</strong> {t.settings.api.autoActiveText}
        <br />
        <span className="text-xs text-emerald-700">{t.settings.api.restartHint}</span>
      </div>

      {groups.map((g) => (
        <section key={g.title} className="card card-pad max-w-3xl">
          <h3 className="font-medium text-ink-900 mb-1">{g.title}</h3>
          {g.hint && <p className="text-xs text-ink-500 mb-3">{g.hint}</p>}
          <div className="space-y-3">
            {g.keys.map((k) => {
              const item = data.items[k];
              if (!item) return null;
              return (
                <EnvField
                  key={k}
                  envKey={k}
                  current={item}
                  newValue={updates[k]}
                  onChange={(v) => setUpdates({ ...updates, [k]: v })}
                />
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex items-center gap-3 max-w-3xl">
        <button className="btn-primary" onClick={save} disabled={saving || Object.keys(updates).length === 0}>
          {saving ? t.settings.api.writing : t.settings.api.saveCount(Object.keys(updates).length)}
        </button>
        {msg && <span className={`text-sm ${msg.startsWith("✓") ? "text-emerald-700" : "text-red-600"}`}>{msg}</span>}
      </div>
    </div>
  );
}

// Env key → which provider's test endpoint to use (null = no test available)
const TEST_PROVIDER_FOR: Record<string, "anthropic" | "openai" | "google_ads" | "search_console" | "serpapi" | "apify" | null> = {
  ANTHROPIC_API_KEY: "anthropic",
  OPENAI_API_KEY: "openai",
  SERPAPI_KEY: "serpapi",
  APIFY_API_TOKEN: "apify",
  GOOGLE_ADS_DEVELOPER_TOKEN: "google_ads",
  SEARCH_CONSOLE_SITE_URL: "search_console",
};

function EnvField({
  envKey, current, newValue, onChange,
}: {
  envKey: string; current: EnvItem; newValue?: string; onChange: (v: string) => void;
}) {
  const t = useT();
  const placeholder = current.is_set ? current.value : t.settings.api.empty;
  const testProvider = TEST_PROVIDER_FOR[envKey];
  return (
    <div>
      <label className="label block mb-1">{envKey}</label>
      <input
        type={current.is_sensitive ? "password" : "text"}
        className="input font-mono text-xs"
        placeholder={placeholder}
        value={newValue ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {current.is_set && newValue === undefined && (
        <div className="text-xs text-ink-500 mt-0.5">
          {t.settings.api.currentValue}: <span className="font-mono">{current.value}</span> — {t.settings.api.changeHint}
        </div>
      )}
      {testProvider && current.is_set && (
        <TestKeyButton provider={testProvider} />
      )}
    </div>
  );
}

function CategoriesTab({ settings }: { settings: AppSettings }) {
  const t = useT();
  const TPL_LABELS: Record<string, string> = {
    education: t.settings.categories.tplEducation,
    ecommerce: t.settings.categories.tplEcommerce,
    saas: t.settings.categories.tplSaas,
    content: t.settings.categories.tplContent,
  };
  const { data: cats, mutate } = useSWR<CategoryItem[]>("/api/settings/categories", api.fetcher);
  const [newCat, setNewCat] = useState({ name: "", triggers: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const add = async () => {
    if (!newCat.name.trim()) return;
    setBusy(true);
    try {
      await api.addCat(newCat.name, newCat.triggers);
      setNewCat({ name: "", triggers: "" });
      mutate();
    } catch (e: any) {
      setMsg(`${t.common.error}: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm(t.settings.categories.confirmDelete)) return;
    await api.removeCat(id);
    mutate();
  };

  const loadTemplate = async (template: string) => {
    setBusy(true);
    try {
      const r = await api.loadCatTemplate(template);
      setMsg(t.settings.categories.tplAdded(r.added, TPL_LABELS[template] || template));
      mutate();
    } catch (e: any) {
      setMsg(`${t.common.error}: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const askAI = async () => {
    if (!settings.brand_name) {
      setMsg(t.settings.categories.brandRequired);
      return;
    }
    setBusy(true);
    setMsg(t.settings.categories.aiPreparing);
    try {
      const r = await api.aiSuggestCategories(settings.brand_name, settings.brand_description);
      let added = 0;
      for (const c of r.categories) {
        await api.addCat(c.name, c.triggers);
        added++;
      }
      setMsg(t.settings.categories.aiAdded(added));
      mutate();
    } catch (e: any) {
      setMsg(`${t.common.error}: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card card-pad">
        <h3 className="font-medium text-ink-900 mb-2">{t.settings.categories.template}</h3>
        <p className="text-xs text-ink-500 mb-3">{t.settings.categories.templateHint}</p>
        <div className="flex gap-2 flex-wrap">
          {["education", "ecommerce", "saas", "content"].map((tpl) => (
            <button key={tpl} className="btn-ghost text-xs" onClick={() => loadTemplate(tpl)} disabled={busy}>
              {TPL_LABELS[tpl]}
            </button>
          ))}
          <button className="btn-primary text-xs" onClick={askAI} disabled={busy || !settings.brand_name}>
            {t.settings.categories.aiSuggest}
          </button>
        </div>
        {msg && <div className={`text-sm mt-3 ${msg.startsWith("✓") ? "text-emerald-700" : "text-ink-700"}`}>{msg}</div>}
      </div>

      <div className="card card-pad">
        <h3 className="font-medium text-ink-900 mb-3">{t.settings.categories.addNew}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <Field label={t.settings.categories.catName} value={newCat.name} onChange={(v) => setNewCat({ ...newCat, name: v })} placeholder={t.settings.categories.catNamePh} />
          <Field label={t.settings.categories.triggers} value={newCat.triggers} onChange={(v) => setNewCat({ ...newCat, triggers: v })} placeholder={t.settings.categories.triggersPh} />
        </div>
        <button className="btn-primary text-sm" onClick={add} disabled={busy || !newCat.name}>{t.settings.categories.add}</button>
      </div>

      {cats && cats.length > 0 && (
        <div className="card card-pad">
          <h3 className="font-medium text-ink-900 mb-3">{t.settings.categories.defined} ({cats.length})</h3>
          <div className="space-y-2">
            {cats.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-2 rounded border border-ink-100">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-900 text-sm">{c.name}</div>
                  <div className="text-xs text-ink-500 truncate">
                    {c.triggers.length > 0 ? c.triggers.join(", ") : t.settings.categories.noTriggers}
                  </div>
                </div>
                <button
                  className="text-xs text-red-600 hover:underline ml-3 shrink-0"
                  onClick={() => remove(c.id)}
                >
                  {t.common.delete}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SiteTab({ settings, onSave }: { settings: AppSettings; onSave: () => void }) {
  const t = useT();
  const [path, setPath] = useState(settings.site_path);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; detail?: string; warning?: boolean } | null>(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.updateSettings({ site_path: path });
      setMsg(t.settings.site.saved);
      onSave();
    } catch (e: any) {
      setMsg(`${t.common.error}: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const testPath = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.testSitePath(path);
      setTestResult(r);
    } catch (e: any) {
      setTestResult({ ok: false, message: t.common.error, detail: e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card card-pad max-w-2xl space-y-4">
      <p className="text-sm text-ink-500">{t.settings.site.hint}</p>
      <Field
        label={t.settings.site.label}
        value={path}
        onChange={setPath}
        placeholder={t.settings.site.placeholder}
      />
      {testResult && (
        <div className={`text-sm p-2 rounded-md ${
          testResult.ok && !testResult.warning ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
          testResult.warning ? "bg-amber-50 text-amber-700 border border-amber-100" :
          "bg-red-50 text-red-600 border border-red-100"
        }`}>
          <div className="font-medium">{testResult.message}</div>
          {testResult.detail && <div className="text-xs mt-0.5">{testResult.detail}</div>}
        </div>
      )}
      <p className="text-xs text-ink-500">{t.settings.site.cloudHint}</p>
      <div className="flex items-center gap-3 flex-wrap">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? t.common.saving : t.common.save}
        </button>
        <button
          className="text-sm px-3 py-2 rounded-md border border-ink-200 hover:bg-ink-50 disabled:opacity-50"
          onClick={testPath}
          disabled={testing || !path}
        >
          {testing ? t.settings.test.testing : "🔍 " + t.settings.test.btn}
        </button>
        {msg && <span className={`text-sm ${msg.startsWith("✓") ? "text-emerald-700" : "text-red-600"}`}>{msg}</span>}
      </div>
    </div>
  );
}

function SystemTab({ settings, onSave }: { settings: AppSettings; onSave: () => void }) {
  const t = useT();
  const { setLang } = useLang();
  const [form, setForm] = useState({ geo_target: settings.geo_target, language: settings.language });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.updateSettings(form);
      setLang(form.language.toLowerCase().startsWith("en") ? "en" : "tr");
      setMsg(t.settings.system.saved);
      onSave();
    } catch (e: any) {
      setMsg(`${t.common.error}: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card card-pad space-y-4">
        <p className="text-sm text-ink-500">{t.settings.system.hint}</p>

        <div>
          <label className="label block mb-1">{t.settings.system.language}</label>
          <select
            className="input"
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
          >
            <option value="tr-TR">🇹🇷 Türkçe (tr-TR)</option>
            <option value="en-US">🇺🇸 English (en-US)</option>
          </select>
          <p className="text-xs text-ink-500 mt-1">{t.settings.system.languageHint}</p>
        </div>

        <div>
          <label className="label block mb-1">{t.settings.system.geo}</label>
          <select
            className="input"
            value={form.geo_target}
            onChange={(e) => setForm({ ...form, geo_target: e.target.value })}
          >
            <option value="TR">{t.settings.system.geoTr}</option>
            <option value="US">{t.settings.system.geoUs}</option>
            <option value="GB">{t.settings.system.geoGb}</option>
            <option value="DE">{t.settings.system.geoDe}</option>
            <option value="FR">{t.settings.system.geoFr}</option>
            <option value="">{t.settings.system.geoWorld}</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? t.common.saving : t.common.save}
          </button>
          {msg && <span className={`text-sm ${msg.startsWith("✓") ? "text-emerald-700" : "text-red-600"}`}>{msg}</span>}
        </div>

        <p className="text-xs text-ink-500 pt-2 border-t border-ink-100">{t.settings.system.footer}</p>
      </div>

      <UpdateCard />
      <ResetCard />
    </div>
  );
}

function UpdateCard() {
  const t = useT();
  const [check, setCheck] = useState<UpdateCheckResponse | null>(null);
  const [busy, setBusy] = useState<"check" | "apply" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "applying" | "restarting" | "reconnecting" | "done">("idle");
  const [version, setVersion] = useState<{ is_git: boolean; short?: string; subject?: string; branch?: string } | null>(null);

  useEffect(() => {
    api.systemVersion().then((v) => setVersion(v)).catch(() => {});
  }, []);

  const runCheck = async () => {
    setBusy("check");
    setErr(null);
    try {
      const r = await api.systemCheckUpdate();
      setCheck(r);
      if (r.error) setErr(r.error);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    setBusy("apply");
    setErr(null);
    setPhase("applying");
    try {
      await api.systemApplyUpdate(true);
      setPhase("restarting");
      // Poll for backend to come back
      const startedAt = Date.now();
      const poll = async () => {
        while (Date.now() - startedAt < 60_000) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const v = await api.systemVersion();
            if (v) {
              setVersion(v);
              setPhase("done");
              setCheck(null);
              return;
            }
          } catch {}
          setPhase("reconnecting");
        }
      };
      poll();
    } catch (e: any) {
      setErr(e.message);
      setPhase("idle");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card card-pad space-y-3">
      <div>
        <h3 className="font-medium text-ink-900">{t.settings.update.title}</h3>
        <p className="text-xs text-ink-500 mt-1">{t.settings.update.hint}</p>
      </div>

      {version?.is_git === false ? (
        <div className="text-sm text-ink-500">{t.settings.update.notGit}</div>
      ) : (
        <>
          <div className="text-xs text-ink-500">
            {t.settings.update.currentLabel}: <code className="text-ink-700 bg-ink-100 px-1.5 py-0.5 rounded">{version?.short || "—"}</code>
            {version?.branch && <span className="ml-2">({version.branch})</span>}
            {version?.subject && <div className="text-ink-700 mt-1 truncate">{version.subject}</div>}
          </div>

          {phase === "idle" && !check && (
            <button className="btn-primary text-sm" onClick={runCheck} disabled={busy !== null}>
              {busy === "check" ? t.settings.update.checking : t.settings.update.checkBtn}
            </button>
          )}

          {check && check.update_available === false && phase === "idle" && (
            <div className="text-sm text-emerald-700">{t.settings.update.upToDate}</div>
          )}

          {check && check.update_available && (
            <div className="space-y-2">
              <div className="text-sm text-ink-700">{t.settings.update.behindBy(check.behind || 0)}</div>
              {check.has_local_changes && (
                <div className="text-sm text-amber-700">{t.settings.update.hasLocalChanges}</div>
              )}
              {(check.requirements_changed || check.package_json_changed) && (
                <div className="text-xs text-ink-500">{t.settings.update.depsWillInstall}</div>
              )}
              {check.changelog && check.changelog.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-ink-700">{t.settings.update.changelog} ({check.changelog.length})</summary>
                  <ul className="mt-2 space-y-1">
                    {check.changelog.map((c) => (
                      <li key={c.hash} className="text-ink-700">
                        <code className="text-ink-500 mr-2">{c.hash}</code>
                        {c.subject}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <button
                className="btn-primary text-sm"
                onClick={apply}
                disabled={busy !== null || check.has_local_changes || phase !== "idle"}
              >
                {busy === "apply" ? t.settings.update.applying : t.settings.update.applyBtn}
              </button>
            </div>
          )}

          {phase === "restarting" && (
            <div className="text-sm text-ink-700">{t.settings.update.restarting}</div>
          )}
          {phase === "reconnecting" && (
            <div className="text-sm text-ink-500">{t.settings.update.reconnecting}</div>
          )}
          {phase === "done" && (
            <div className="text-sm text-emerald-700">{t.settings.update.done}</div>
          )}

          {err && <div className="text-sm text-red-600">{t.settings.update.error}: {err}</div>}
        </>
      )}
    </div>
  );
}

function ResetCard() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"data" | "data_and_settings" | "all">("data");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (confirm !== "RESET") return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.systemReset(scope);
      setMsg(t.settings.reset.cleared(r.cleared.length));
      setOpen(false);
      setConfirm("");
      if (r.restarting) {
        setTimeout(() => window.location.reload(), 6000);
      } else {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad border-red-100 bg-red-50/20 space-y-3">
      <div>
        <h3 className="font-medium text-ink-900">{t.settings.reset.title}</h3>
        <p className="text-xs text-ink-500 mt-1">{t.settings.reset.hint}</p>
      </div>

      {msg && <div className="text-sm text-emerald-700">{msg}{scope === "all" ? ` ${t.settings.reset.restartingNote}` : ""}</div>}
      {err && <div className="text-sm text-red-600">{t.settings.reset.error}: {err}</div>}

      {!open ? (
        <button
          className="text-sm px-3 py-2 rounded-md border border-red-200 text-red-700 hover:bg-red-50"
          onClick={() => setOpen(true)}
        >
          {t.settings.reset.openBtn}
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-ink-700">{t.settings.reset.modalIntro}</p>
          <div className="space-y-2">
            {[
              { v: "data" as const, label: t.settings.reset.scopeData, hint: t.settings.reset.scopeDataHint },
              { v: "data_and_settings" as const, label: t.settings.reset.scopeDataAndSettings, hint: t.settings.reset.scopeDataAndSettingsHint },
              { v: "all" as const, label: t.settings.reset.scopeAll, hint: t.settings.reset.scopeAllHint },
            ].map((opt) => (
              <label
                key={opt.v}
                className={`block p-3 rounded-md border cursor-pointer transition ${
                  scope === opt.v ? "border-red-200 bg-white" : "border-ink-200 bg-white hover:border-red-100"
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    className="mt-1"
                    checked={scope === opt.v}
                    onChange={() => setScope(opt.v)}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-ink-900">{opt.label}</div>
                    <div className="text-xs text-ink-500 mt-0.5">{opt.hint}</div>
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div>
            <label className="label block mb-1">{t.settings.reset.confirmLabel}</label>
            <input
              className="input font-mono"
              placeholder={t.settings.reset.confirmPh}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              className="text-sm px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              onClick={submit}
              disabled={busy || confirm !== "RESET"}
            >
              {busy ? t.settings.reset.submitting : t.settings.reset.submitBtn}
            </button>
            <button
              className="btn-ghost text-sm"
              onClick={() => { setOpen(false); setConfirm(""); setErr(null); }}
              disabled={busy}
            >
              {t.settings.reset.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, textarea,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean;
}) {
  return (
    <div>
      <label className="label block mb-1">{label}</label>
      {textarea ? (
        <textarea className="input min-h-[80px]" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}

function HealthCard({ onJump }: { onJump: (tab: Tab) => void }) {
  const t = useT();
  const { data, mutate } = useSWR<HealthCheckResponse>("/api/settings/health", api.fetcher, {
    refreshInterval: 60_000,
  });
  if (!data) return null;

  const STATUS_STYLE: Record<string, string> = {
    ok: "bg-emerald-500",
    partial: "bg-amber-500",
    missing: "bg-red-500",
    optional: "bg-ink-300",
  };
  const STATUS_LABEL: Record<string, string> = {
    ok: "🟢", partial: "🟡", missing: "🔴", optional: "⚪",
  };

  return (
    <div className="card card-pad mb-6 bg-gradient-to-br from-ink-50/40 to-white">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-xs font-medium text-ink-500 uppercase tracking-wide">
            {t.settings.health.title}
          </div>
          <div className="text-sm text-ink-700 mt-1">
            {data.fully_setup ? `✓ ${t.settings.health.ready}` : t.settings.health.partial(data.required_ok, data.required_total)}
          </div>
        </div>
        <button className="text-xs text-ink-500 hover:text-ink-900" onClick={() => mutate()}>↻</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {data.items.map((it) => (
          <button
            key={it.id}
            onClick={() => it.tab && onJump(it.tab as Tab)}
            disabled={!it.tab}
            className={`flex items-start gap-2 p-2 rounded-md border text-left transition ${
              it.tab ? "hover:border-brand-200 hover:bg-brand-50/30 cursor-pointer" : "cursor-default"
            } border-ink-200 bg-white`}
          >
            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${STATUS_STYLE[it.status]}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-ink-900">{it.label}</span>
                {it.optional && (
                  <span className="text-[10px] text-ink-500 px-1.5 py-0.5 rounded bg-ink-100">opsiyonel</span>
                )}
              </div>
              <div className="text-xs text-ink-500 truncate">{it.detail}</div>
            </div>
            {it.tab && it.status !== "ok" && !it.optional && (
              <span className="text-xs text-brand-700 shrink-0 mt-1">→</span>
            )}
          </button>
        ))}
      </div>

      <div className="text-xs text-ink-500 mt-3 pt-2 border-t border-ink-100">
        {t.settings.health.legend}
      </div>
    </div>
  );
}

function TestKeyButton({ provider }: { provider: "anthropic" | "openai" | "google_ads" | "search_console" | "serpapi" | "apify" }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; detail?: string } | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await api.testApiKey(provider);
      setResult(r);
    } catch (e: any) {
      setResult({ ok: false, message: t.common.error, detail: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-start gap-2 mt-1.5">
      <button
        onClick={run}
        disabled={busy}
        className="text-xs px-2 py-1 rounded border border-ink-200 hover:bg-ink-50 disabled:opacity-50"
      >
        {busy ? t.settings.test.testing : "🔍 " + t.settings.test.btn}
      </button>
      {result && (
        <div className={`text-xs flex-1 ${result.ok ? "text-emerald-700" : "text-red-600"}`}>
          {result.message}
          {result.detail && <div className="text-ink-500 mt-0.5">{result.detail}</div>}
        </div>
      )}
    </div>
  );
}

