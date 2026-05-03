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
        <h2 className="font-medium text-ink-900 mb-3">📚 Detaylı Rehberler</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <a
              href="https://github.com/your-org/trend-bulucu/blob/main/docs/SETUP.md"
              target="_blank"
              rel="noreferrer"
              className="text-brand-700 hover:underline"
            >
              📘 Adım Adım Kurulum (SETUP.md)
            </a>
            <span className="text-ink-500 ml-2">— sıfırdan kurulum, Python/Node, .env, ilk giriş</span>
          </li>
          <li>
            <a
              href="https://github.com/your-org/trend-bulucu/blob/main/docs/INTEGRATIONS.md"
              target="_blank"
              rel="noreferrer"
              className="text-brand-700 hover:underline"
            >
              🔌 Entegrasyon Rehberi (INTEGRATIONS.md)
            </a>
            <span className="text-ink-500 ml-2">— Google Search Console, Google Ads, AI sağlayıcıları detayı</span>
          </li>
        </ul>
      </div>

      <div className="card card-pad mt-4 max-w-3xl bg-ink-50/40">
        <h2 className="font-medium text-ink-900 mb-3">💡 Öneri Sırası</h2>
        <ol className="space-y-1.5 text-sm list-decimal list-inside text-ink-700">
          <li><strong>Marka + AI + Kategori + Kelime + İlk Veri</strong> — bu 5 zorunlu adımı bitirince temel sistem aktif</li>
          <li><strong>Site Yolu + Site Tarama</strong> — sitenin lokal kopyasını bağla, içerik boşluk analizi açılır</li>
          <li><strong>Search Console</strong> — gerçek SEO performansı (~30 dk kurulum, ücretsiz)</li>
          <li><strong>Google Ads</strong> — gerçek aylık hacim (onay süreci 1-2 iş günü, sonra dakikalar)</li>
        </ol>
        <p className="text-xs text-ink-500 mt-3">
          İlk 5 adımı tamamladığında sistem zaten çok şey yapar. Ads ve GSC sonradan eklenebilir.
        </p>
      </div>
    </div>
  );
}
