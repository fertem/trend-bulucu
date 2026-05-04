"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, AppSettings, CategoryItem, EnvItem } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { useT, useLang } from "@/lib/i18n";

type Tab = "brand" | "api" | "categories" | "site" | "system";

export default function SettingsPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("brand");
  const { data, mutate } = useSWR<{ settings: AppSettings; configured: boolean }>("/api/settings", api.fetcher);
  const settings = data?.settings;

  const TABS: { key: Tab; label: string; emoji: string }[] = [
    { key: "brand", label: t.settings.tabs.brand, emoji: "🏷️" },
    { key: "api", label: t.settings.tabs.api, emoji: "🔑" },
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

function EnvField({
  envKey, current, newValue, onChange,
}: {
  envKey: string; current: EnvItem; newValue?: string; onChange: (v: string) => void;
}) {
  const t = useT();
  const placeholder = current.is_set ? current.value : t.settings.api.empty;
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

  return (
    <div className="card card-pad max-w-2xl space-y-4">
      <p className="text-sm text-ink-500">{t.settings.site.hint}</p>
      <Field
        label={t.settings.site.label}
        value={path}
        onChange={setPath}
        placeholder={t.settings.site.placeholder}
      />
      <p className="text-xs text-ink-500">{t.settings.site.cloudHint}</p>
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? t.common.saving : t.common.save}
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
    <div className="card card-pad max-w-2xl space-y-4">
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
