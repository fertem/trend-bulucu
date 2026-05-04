"use client";

import { PageHeader } from "@/components/PageHeader";
import { SetupChecklist } from "@/components/SetupChecklist";
import { useT } from "@/lib/i18n";

export default function SetupGuidePage() {
  const t = useT();
  return (
    <div>
      <PageHeader
        title={t.setup.title}
        subtitle={t.setup.subtitle}
      />
      <SetupChecklist alwaysShow />

      <div className="card card-pad mt-6 max-w-3xl">
        <h2 className="font-medium text-ink-900 mb-3">{t.setup.docs}</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <a
              href="https://github.com/fertem/trend-bulucu/blob/main/docs/SETUP.md"
              target="_blank"
              rel="noreferrer"
              className="text-brand-700 hover:underline"
            >
              {t.setup.setupDoc}
            </a>
            <span className="text-ink-500 ml-2">— {t.setup.setupDocHint}</span>
          </li>
          <li>
            <a
              href="https://github.com/fertem/trend-bulucu/blob/main/docs/INTEGRATIONS.md"
              target="_blank"
              rel="noreferrer"
              className="text-brand-700 hover:underline"
            >
              {t.setup.integrationsDoc}
            </a>
            <span className="text-ink-500 ml-2">— {t.setup.integrationsDocHint}</span>
          </li>
        </ul>
      </div>

      <div className="card card-pad mt-4 max-w-3xl bg-ink-50/40">
        <h2 className="font-medium text-ink-900 mb-3">{t.setup.suggestedOrder}</h2>
        <ol className="space-y-1.5 text-sm list-decimal list-inside text-ink-700">
          <li>{t.setup.suggestedOrder1}</li>
          <li>{t.setup.suggestedOrder2}</li>
          <li>{t.setup.suggestedOrder3}</li>
          <li>{t.setup.suggestedOrder4}</li>
        </ol>
        <p className="text-xs text-ink-500 mt-3">{t.setup.suggestedOrderFooter}</p>
      </div>
    </div>
  );
}
