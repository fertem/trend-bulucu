"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, AppSettings, CategoryItem, EnvItem } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";

type Tab = "brand" | "api" | "categories" | "site" | "system";

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: "brand", label: "Marka", emoji: "🏷️" },
  { key: "api", label: "API Anahtarları", emoji: "🔑" },
  { key: "categories", label: "Kelime + Kategori", emoji: "📁" },
  { key: "site", label: "Site", emoji: "🌐" },
  { key: "system", label: "Sistem", emoji: "⚙️" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("brand");
  const { data, mutate } = useSWR<{ settings: AppSettings; configured: boolean }>("/api/settings", api.fetcher);
  const settings = data?.settings;

  return (
    <div>
      <PageHeader
        title="Ayarlar"
        subtitle="Marka bilgileri, API anahtarları, kategoriler ve site bağlantısı."
        actions={
          !data?.configured ? (
            <Link href="/settings/setup" className="btn-primary">
              🪄 Hızlı Kurulum Sihirbazı
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

      {!settings && <div className="text-sm text-ink-500">Yükleniyor…</div>}
      {settings && tab === "brand" && <BrandTab settings={settings} onSave={() => mutate()} />}
      {settings && tab === "api" && <APITab />}
      {settings && tab === "categories" && <CategoriesTab settings={settings} />}
      {settings && tab === "site" && <SiteTab settings={settings} onSave={() => mutate()} />}
      {settings && tab === "system" && <SystemTab settings={settings} onSave={() => mutate()} />}
    </div>
  );
}

function BrandTab({ settings, onSave }: { settings: AppSettings; onSave: () => void }) {
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
      setMsg("✓ Marka bilgileri kaydedildi.");
      onSave();
    } catch (e: any) {
      setMsg(`Hata: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card card-pad max-w-2xl space-y-4">
      <p className="text-sm text-ink-500">
        Bu bilgiler AI prompt'larında kullanılır — özetler, içerik önerileri ve analiz sonuçları markanıza özel olur.
      </p>
      <Field label="Marka Adı" value={form.brand_name} onChange={(v) => setForm({ ...form, brand_name: v })} placeholder="örn. Şirketim" />
      <Field label="Site URL'si" value={form.brand_url} onChange={(v) => setForm({ ...form, brand_url: v })} placeholder="https://www.example.com" />
      <Field
        label="Marka Açıklaması"
        value={form.brand_description}
        onChange={(v) => setForm({ ...form, brand_description: v })}
        placeholder="örn. Çocuklar için online kodlama eğitimi platformu"
        textarea
      />
      <Field
        label="Hedef Kitle"
        value={form.target_audience}
        onChange={(v) => setForm({ ...form, target_audience: v })}
        placeholder="örn. Türkiye'de 6-14 yaş çocuğu olan anneler"
      />
      <Field
        label="Sektör"
        value={form.industry}
        onChange={(v) => setForm({ ...form, industry: v })}
        placeholder="örn. eğitim, e-ticaret, SaaS"
      />
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {msg && <span className={`text-sm ${msg.startsWith("✓") ? "text-emerald-700" : "text-red-600"}`}>{msg}</span>}
      </div>
    </div>
  );
}

function APITab() {
  const { data, mutate } = useSWR<{ items: Record<string, EnvItem> }>("/api/settings/env", api.fetcher);
  const [updates, setUpdates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!data) return <div className="text-sm text-ink-500">Yükleniyor…</div>;

  const groups: { title: string; keys: string[]; hint?: string }[] = [
    {
      title: "AI Sağlayıcı (en az biri)",
      keys: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "AI_PROVIDER"],
      hint: "Anthropic anahtarın varsa öncelikli olur. AI_PROVIDER: 'anthropic' veya 'openai'.",
    },
    {
      title: "Google Ads (Keyword Planner — opsiyonel)",
      keys: [
        "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET",
        "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID",
        "GOOGLE_ADS_LOGIN_CUSTOMER_ID", "GOOGLE_ADS_API_VERSION",
      ],
    },
    {
      title: "Search Console (opsiyonel — gerçek pozisyon/CTR)",
      keys: ["SEARCH_CONSOLE_SITE_URL"],
    },
    {
      title: "Pytrends",
      keys: ["PYTRENDS_GEO", "PYTRENDS_HL", "PYTRENDS_TIMEFRAME", "REQUEST_DELAY_SECONDS", "MAX_RETRIES"],
    },
    {
      title: "Zamanlama",
      keys: ["COLLECT_HOUR", "COLLECT_MINUTE", "TIMEZONE"],
    },
    {
      title: "Auth (admin)",
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
      setMsg(`${reloadIcon} ${r.written.length} alan güncellendi. ${r.note || ""}`);
      setUpdates({});
      mutate();
    } catch (e: any) {
      setMsg(`Hata: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card card-pad bg-emerald-50/40 border-emerald-100 text-sm text-emerald-900">
        ✨ <strong>Otomatik aktif:</strong> API anahtarları <code>.env</code>'ye yazılır ve <strong>hemen</strong> kullanılmaya başlar — backend'i yeniden başlatmana gerek yok.
        <br />
        <span className="text-xs text-emerald-700">İstisna: Zamanlayıcı ayarları (COLLECT_HOUR/MINUTE/TIMEZONE) için restart gerekir.</span>
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
          {saving ? "Yazılıyor…" : `${Object.keys(updates).length} değişikliği kaydet`}
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
  const placeholder = current.is_set ? current.value : "(boş)";
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
          Mevcut: <span className="font-mono">{current.value}</span> — değiştirmek için yeni değer gir
        </div>
      )}
    </div>
  );
}

function CategoriesTab({ settings }: { settings: AppSettings }) {
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
      setMsg(`Hata: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Kategori silinsin mi?")) return;
    await api.removeCat(id);
    mutate();
  };

  const loadTemplate = async (template: string) => {
    setBusy(true);
    try {
      const r = await api.loadCatTemplate(template);
      setMsg(`✓ ${r.added} kategori eklendi (${template} şablonu)`);
      mutate();
    } catch (e: any) {
      setMsg(`Hata: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const askAI = async () => {
    if (!settings.brand_name) {
      setMsg("Önce 'Marka' sekmesinden marka bilgilerini doldurun.");
      return;
    }
    setBusy(true);
    setMsg("AI önerileri hazırlıyor…");
    try {
      const r = await api.aiSuggestCategories(settings.brand_name, settings.brand_description);
      let added = 0;
      for (const c of r.categories) {
        await api.addCat(c.name, c.triggers);
        added++;
      }
      setMsg(`✓ AI ${added} kategori önerdi ve eklendi.`);
      mutate();
    } catch (e: any) {
      setMsg(`Hata: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card card-pad">
        <h3 className="font-medium text-ink-900 mb-2">Hızlı Şablon</h3>
        <p className="text-xs text-ink-500 mb-3">Sektörünüze uygun hazır kategori paketini yükleyin (mevcutları silmez):</p>
        <div className="flex gap-2 flex-wrap">
          {["education", "ecommerce", "saas", "content"].map((t) => (
            <button key={t} className="btn-ghost text-xs" onClick={() => loadTemplate(t)} disabled={busy}>
              {t === "education" ? "Eğitim" : t === "ecommerce" ? "E-ticaret" : t === "saas" ? "SaaS" : "İçerik"}
            </button>
          ))}
          <button className="btn-primary text-xs" onClick={askAI} disabled={busy || !settings.brand_name}>
            🪄 AI'dan Marka Bazlı Öner
          </button>
        </div>
        {msg && <div className={`text-sm mt-3 ${msg.startsWith("✓") ? "text-emerald-700" : "text-ink-700"}`}>{msg}</div>}
      </div>

      <div className="card card-pad">
        <h3 className="font-medium text-ink-900 mb-3">Yeni Kategori Ekle</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <Field label="Kategori adı" value={newCat.name} onChange={(v) => setNewCat({ ...newCat, name: v })} placeholder="örn. Eğitim" />
          <Field label="Tetikleyiciler (virgülle)" value={newCat.triggers} onChange={(v) => setNewCat({ ...newCat, triggers: v })} placeholder="örn. eğitim, ders, kurs, okul" />
        </div>
        <button className="btn-primary text-sm" onClick={add} disabled={busy || !newCat.name}>Ekle</button>
      </div>

      {cats && cats.length > 0 && (
        <div className="card card-pad">
          <h3 className="font-medium text-ink-900 mb-3">Tanımlı Kategoriler ({cats.length})</h3>
          <div className="space-y-2">
            {cats.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-2 rounded border border-ink-100">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-900 text-sm">{c.name}</div>
                  <div className="text-xs text-ink-500 truncate">
                    {c.triggers.length > 0 ? c.triggers.join(", ") : "(tetikleyici yok)"}
                  </div>
                </div>
                <button
                  className="text-xs text-red-600 hover:underline ml-3 shrink-0"
                  onClick={() => remove(c.id)}
                >
                  Sil
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
  const [path, setPath] = useState(settings.site_path);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.updateSettings({ site_path: path });
      setMsg("✓ Site yolu kaydedildi.");
      onSave();
    } catch (e: any) {
      setMsg(`Hata: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card card-pad max-w-2xl space-y-4">
      <p className="text-sm text-ink-500">
        İçerik boşluk analizi için sitenizin lokal kaynak kodu klasörünün yolunu girin (Next.js / Remix / generic markdown blog vb.).
        Klasör altında <code>app/</code> veya <code>app/blog/</code> bekleniyor.
      </p>
      <Field
        label="Lokal Site Yolu"
        value={path}
        onChange={setPath}
        placeholder="c:/Users/.../my-site"
      />
      <p className="text-xs text-ink-500">
        Site bulutta (Vercel/Netlify) ise: repo'yu lokale clone edip yolunu burada gir. Daha sonra Genel Bakış'tan "Siteyi Tara" diyebilirsin.
      </p>
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {msg && <span className={`text-sm ${msg.startsWith("✓") ? "text-emerald-700" : "text-red-600"}`}>{msg}</span>}
      </div>
    </div>
  );
}

function SystemTab({ settings, onSave }: { settings: AppSettings; onSave: () => void }) {
  const [form, setForm] = useState({ geo_target: settings.geo_target, language: settings.language });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.updateSettings(form);
      setMsg("✓ Sistem ayarları kaydedildi. AI cevapları yeni dilde gelecek.");
      onSave();
    } catch (e: any) {
      setMsg(`Hata: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card card-pad max-w-2xl space-y-4">
      <p className="text-sm text-ink-500">Pytrends coğrafya + AI çıktı dili.</p>

      <div>
        <label className="label block mb-1">AI Çıktı Dili</label>
        <select
          className="input"
          value={form.language}
          onChange={(e) => setForm({ ...form, language: e.target.value })}
        >
          <option value="tr-TR">🇹🇷 Türkçe (tr-TR)</option>
          <option value="en-US">🇺🇸 English (en-US)</option>
        </select>
        <p className="text-xs text-ink-500 mt-1">
          AI sohbet, yazı üretimi, kelime önerileri bu dilde olur. UI ve veri Türkçe kalır.
        </p>
      </div>

      <div>
        <label className="label block mb-1">Coğrafya (Pytrends geo)</label>
        <select
          className="input"
          value={form.geo_target}
          onChange={(e) => setForm({ ...form, geo_target: e.target.value })}
        >
          <option value="TR">🇹🇷 Türkiye (TR)</option>
          <option value="US">🇺🇸 ABD (US)</option>
          <option value="GB">🇬🇧 İngiltere (GB)</option>
          <option value="DE">🇩🇪 Almanya (DE)</option>
          <option value="FR">🇫🇷 Fransa (FR)</option>
          <option value="">🌍 Dünya (boş = global)</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {msg && <span className={`text-sm ${msg.startsWith("✓") ? "text-emerald-700" : "text-red-600"}`}>{msg}</span>}
      </div>

      <p className="text-xs text-ink-500 pt-2 border-t border-ink-100">
        Dil değişikliği <strong>hemen aktif</strong> — AI bir sonraki istekte yeni dilde cevap verir.
        Coğrafya değişimi sonraki Pytrends fetch'inde geçerli olur.
      </p>
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
