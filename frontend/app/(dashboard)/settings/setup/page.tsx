"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/lib/i18n";

type Step = 1 | 2 | 3 | 4 | 5;

export default function SetupWizard() {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  const [brand, setBrand] = useState({
    brand_name: "",
    brand_url: "",
    brand_description: "",
    target_audience: "",
  });

  const [industry, setIndustry] = useState<{ industry: string; industry_label: string; category_template: string; default_audience: string; rationale: string } | null>(null);
  const [aiCategories, setAiCategories] = useState<{ name: string; triggers: string; reason: string }[] | null>(null);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [aiKeywords, setAiKeywords] = useState<{ keyword: string; type: string; reason: string }[] | null>(null);
  const [selectedKws, setSelectedKws] = useState<Set<string>>(new Set());

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goStep2 = async () => {
    if (!brand.brand_name || !brand.brand_description) {
      setError(t.setupWizard.brandReq);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updateSettings(brand);
      try {
        const r = await api.aiDetectIndustry(brand.brand_name, brand.brand_description, brand.brand_url);
        setIndustry(r);
        if (!brand.target_audience && r.default_audience) {
          setBrand((b) => ({ ...b, target_audience: r.default_audience }));
          await api.updateSettings({ target_audience: r.default_audience });
        }
      } catch {}
      setStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const goStep3 = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.aiSuggestCategories(brand.brand_name, brand.brand_description);
      setAiCategories(r.categories);
      setSelectedCats(new Set(r.categories.map((c) => c.name)));
      setStep(3);
    } catch (e: any) {
      setError(t.setupWizard.aiCatFail(e.message));
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  const goStep4 = async () => {
    setBusy(true);
    setError(null);
    try {
      if (aiCategories) {
        for (const c of aiCategories) {
          if (selectedCats.has(c.name)) {
            await api.addCat(c.name, c.triggers);
          }
        }
      }
      const r = await api.aiSuggestKeywords(brand.brand_name, brand.brand_description, brand.target_audience, 15);
      setAiKeywords(r.keywords);
      setSelectedKws(new Set(r.keywords.slice(0, 10).map((k) => k.keyword)));
      setStep(4);
    } catch (e: any) {
      setError(t.setupWizard.aiKwFail(e.message));
      setStep(4);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      if (aiKeywords && selectedKws.size > 0) {
        await api.addKeywords([...selectedKws]);
      }
      await api.markConfigured();
      setStep(5);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={t.setupWizard.title} subtitle={t.setupWizard.subtitle(step)} />

      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`flex-1 h-1.5 rounded ${s <= step ? "bg-brand-600" : "bg-ink-200"}`}
          />
        ))}
      </div>

      {error && <div className="card card-pad mb-4 bg-red-50 border-red-100 text-sm text-red-700">{error}</div>}

      {step === 1 && (
        <div className="card card-pad max-w-2xl space-y-4">
          <h2 className="text-lg font-semibold text-ink-900">{t.setupWizard.step1.title}</h2>
          <p className="text-sm text-ink-500">{t.setupWizard.step1.hint}</p>
          <Field label={t.setupWizard.step1.brandReq} value={brand.brand_name} onChange={(v) => setBrand({ ...brand, brand_name: v })} placeholder={t.setupWizard.step1.brandReqPh} />
          <Field label={t.setupWizard.step1.url} value={brand.brand_url} onChange={(v) => setBrand({ ...brand, brand_url: v })} placeholder={t.setupWizard.step1.urlPh} />
          <Field
            label={t.setupWizard.step1.descReq}
            value={brand.brand_description}
            onChange={(v) => setBrand({ ...brand, brand_description: v })}
            placeholder={t.setupWizard.step1.descReqPh}
            textarea
          />
          <Field label={t.setupWizard.step1.audience} value={brand.target_audience} onChange={(v) => setBrand({ ...brand, target_audience: v })} placeholder={t.setupWizard.step1.audiencePh} />
          <button className="btn-primary" onClick={goStep2} disabled={busy}>
            {busy ? t.setupWizard.step1.saving : t.setupWizard.step1.next}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card card-pad max-w-2xl space-y-4">
          <h2 className="text-lg font-semibold text-ink-900">{t.setupWizard.step2.title}</h2>
          {industry ? (
            <div className="space-y-3">
              <div>
                <div className="label">{t.setupWizard.step2.detected}</div>
                <div className="text-base text-ink-900">{industry.industry_label}</div>
              </div>
              {industry.default_audience && (
                <div>
                  <div className="label">{t.setupWizard.step2.suggestedAudience}</div>
                  <div className="text-sm text-ink-700">{industry.default_audience}</div>
                </div>
              )}
              {industry.rationale && (
                <div className="text-xs text-ink-500 italic">"{industry.rationale}"</div>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-500">{t.setupWizard.step2.noDetect}</p>
          )}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setStep(1)}>{t.setupWizard.step2.back}</button>
            <button className="btn-primary" onClick={goStep3} disabled={busy}>
              {busy ? t.setupWizard.step2.working : t.setupWizard.step2.next}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card card-pad max-w-3xl space-y-4">
          <h2 className="text-lg font-semibold text-ink-900">{t.setupWizard.step3.title}</h2>
          <p className="text-sm text-ink-500">{t.setupWizard.step3.hint}</p>
          {aiCategories && aiCategories.length > 0 ? (
            <div className="space-y-2">
              {aiCategories.map((c) => {
                const sel = selectedCats.has(c.name);
                return (
                  <label key={c.name} className={`block p-3 rounded-md border cursor-pointer ${sel ? "border-brand-200 bg-brand-50/40" : "border-ink-200 bg-white"}`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={sel}
                        onChange={() => {
                          const next = new Set(selectedCats);
                          if (sel) next.delete(c.name); else next.add(c.name);
                          setSelectedCats(next);
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-ink-900 text-sm">{c.name}</div>
                        <div className="text-xs text-ink-500 mt-0.5">{c.triggers}</div>
                        {c.reason && <div className="text-xs text-ink-500 italic mt-1">"{c.reason}"</div>}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-ink-500">{t.setupWizard.step3.noSuggestions}</p>
          )}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setStep(2)}>{t.setupWizard.step3.back}</button>
            <button className="btn-primary" onClick={goStep4} disabled={busy}>
              {busy ? t.setupWizard.step3.saving : t.setupWizard.step3.next}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card card-pad max-w-3xl space-y-4">
          <h2 className="text-lg font-semibold text-ink-900">{t.setupWizard.step4.title}</h2>
          <p className="text-sm text-ink-500">{t.setupWizard.step4.hint}</p>
          {aiKeywords && aiKeywords.length > 0 ? (
            <div className="space-y-2">
              {aiKeywords.map((k) => {
                const sel = selectedKws.has(k.keyword);
                return (
                  <label key={k.keyword} className={`block p-2.5 rounded-md border cursor-pointer ${sel ? "border-brand-200 bg-brand-50/40" : "border-ink-200 bg-white"}`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={sel}
                        onChange={() => {
                          const next = new Set(selectedKws);
                          if (sel) next.delete(k.keyword); else next.add(k.keyword);
                          setSelectedKws(next);
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-ink-900 text-sm">{k.keyword}</div>
                        <div className="text-xs text-ink-500">
                          <span className="badge badge-cat mr-1.5">{k.type}</span>
                          {k.reason}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-ink-500">{t.setupWizard.step4.noSuggestions}</p>
          )}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setStep(3)}>{t.setupWizard.step4.back}</button>
            <button className="btn-primary" onClick={finish} disabled={busy}>
              {busy ? t.setupWizard.step4.saving : t.setupWizard.step4.finish(selectedKws.size)}
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="card card-pad max-w-2xl space-y-4 bg-emerald-50/40 border-emerald-100">
          <h2 className="text-lg font-semibold text-ink-900">{t.setupWizard.step5.title}</h2>
          <p className="text-sm text-ink-700">{t.setupWizard.step5.intro}</p>
          <ol className="text-sm space-y-2 list-decimal list-inside text-ink-700">
            {t.setupWizard.step5.todo.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => router.push("/")}>{t.setupWizard.step5.goOverview}</button>
            <button className="btn-ghost" onClick={() => router.push("/settings")}>{t.setupWizard.step5.goSettings}</button>
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
