"use client";

import { useState } from "react";
import { api, ArticleOutline, SocialPack } from "@/lib/api";

type Phase = "outline" | "writing" | "social" | "image" | "schema" | "publish" | "done";

export function ArticleWriter({ keyword, category, onClose }: {
  keyword: string;
  category?: string | null;
  onClose: () => void;
}) {
  const [outline, setOutline] = useState<ArticleOutline | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [social, setSocial] = useState<SocialPack | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [schemaData, setSchemaData] = useState<{ article: any; faq: any | null; howto: any | null } | null>(null);
  const [publishResult, setPublishResult] = useState<{ link: string; edit_link: string; platform: string } | null>(null);
  const [tab, setTab] = useState<"outline" | "article" | "social" | "image" | "schema" | "publish">("outline");
  const [busy, setBusy] = useState<Phase | null>("outline");
  const [error, setError] = useState<string | null>(null);

  // Auto-generate outline on mount
  useState(() => {
    (async () => {
      setError(null);
      try {
        const r = await api.articleOutline(keyword, category || undefined);
        setOutline(r);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusy(null);
      }
    })();
  });

  const writeFullArticle = async () => {
    if (!outline) return;
    setBusy("writing");
    setError(null);
    setTab("article");
    try {
      const r = await api.articleWrite(keyword, outline);
      setMarkdown(r.markdown);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const generateSocial = async () => {
    if (!outline) return;
    setBusy("social");
    setError(null);
    setTab("social");
    try {
      const r = await api.articleSocial(keyword, outline);
      setSocial(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const generateCover = async () => {
    if (!outline) return;
    setBusy("image");
    setError(null);
    setTab("image");
    try {
      const r = await api.aiCoverImage(keyword, outline.intro_hook || "");
      setCoverImage(r.url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const generateSchema = async () => {
    if (!outline) return;
    setBusy("schema");
    setError(null);
    setTab("schema");
    try {
      const r = await api.aiSchema(keyword, outline);
      setSchemaData(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const publish = async (platform: "wordpress" | "ghost", status: "draft" | "publish") => {
    if (!outline || !markdown) {
      setError("Önce 'Tam Yazı' üret");
      return;
    }
    setBusy("publish");
    setError(null);
    setTab("publish");
    try {
      const r = await api.publishPost({
        platform,
        title: outline.title || keyword,
        markdown,
        slug: outline.slug,
        excerpt: outline.meta_description,
        feature_image: coverImage || undefined,
        tags: outline.secondary_keywords?.slice(0, 5),
        status,
      });
      setPublishResult({ link: r.link, edit_link: r.edit_link, platform: r.platform });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Panoya kopyalandı");
    } catch {
      alert("Kopyalanamadı");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-ink-200 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-ink-500 uppercase tracking-wide">AI Yazı Üretici</div>
            <h3 className="text-lg font-semibold text-ink-900 mt-0.5">{keyword}</h3>
            {category && <span className="badge badge-cat mt-1">{category}</span>}
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900 text-xl leading-none">×</button>
        </div>

        <div className="flex gap-1 px-6 pt-3 border-b border-ink-100 bg-ink-50/30 overflow-x-auto">
          {([
            ["outline", "Brief"],
            ["article", "Tam Yazı"],
            ["social", "Sosyal Medya"],
            ["image", "Kapak"],
            ["schema", "Schema.org"],
            ["publish", "Yayınla"],
          ] as [typeof tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-t-md whitespace-nowrap ${
                tab === t ? "bg-white text-brand-700 border border-ink-200 border-b-white -mb-px font-medium" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && <div className="text-sm text-red-600 mb-3">Hata: {error}</div>}

          {/* OUTLINE / BRIEF */}
          {tab === "outline" && (
            <div className="space-y-4 text-sm">
              {busy === "outline" && <div className="text-ink-500">AI brief hazırlıyor… (~10-15 sn)</div>}
              {outline && (
                <>
                  <Section title="Title" body={outline.title} copy />
                  <Section title="Slug" body={outline.slug} copy />
                  <Section title="Meta Description" body={outline.meta_description} copy />
                  <Section title="H1" body={outline.h1} />
                  <Section title="Açılış" body={outline.intro_hook} />

                  {outline.outline?.length > 0 && (
                    <div>
                      <div className="label mb-1">Outline ({outline.outline.length} bölüm)</div>
                      <div className="space-y-2">
                        {outline.outline.map((s, i) => (
                          <div key={i} className="border-l-2 border-brand-200 pl-3">
                            <div className="font-medium text-ink-900">H2: {s.h2}</div>
                            {s.h3?.length > 0 && (
                              <ul className="text-xs text-ink-700 mt-1 space-y-0.5">
                                {s.h3.map((h, j) => (<li key={j}>↳ H3: {h}</li>))}
                              </ul>
                            )}
                            {s.key_points?.length > 0 && (
                              <ul className="text-xs text-ink-500 mt-1 list-disc list-inside">
                                {s.key_points.map((p, j) => (<li key={j}>{p}</li>))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {outline.faq?.length > 0 && (
                    <div>
                      <div className="label mb-1">FAQ</div>
                      <div className="space-y-2">
                        {outline.faq.map((f, i) => (
                          <div key={i}>
                            <div className="font-medium text-ink-900">{f.q}</div>
                            <div className="text-ink-700 text-xs">{f.a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {outline.secondary_keywords?.length > 0 && (
                    <div>
                      <div className="label mb-1">Yan SEO Kelimeleri</div>
                      <div className="flex flex-wrap gap-1.5">
                        {outline.secondary_keywords.map((k, i) => (
                          <span key={i} className="badge badge-cat">{k}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-ink-500">Tahmini uzunluk: {outline.estimated_word_count || "~"} kelime</div>

                  <div className="flex gap-2 pt-2 flex-wrap">
                    <button className="btn-primary text-sm" onClick={writeFullArticle} disabled={busy !== null}>
                      ✍️ Tam Yazıyı Üret
                    </button>
                    <button className="btn-ghost text-sm" onClick={generateSocial} disabled={busy !== null}>
                      📱 Sosyal Medya
                    </button>
                    <button className="btn-ghost text-sm" onClick={generateCover} disabled={busy !== null}>
                      🎨 Kapak Görseli
                    </button>
                    <button className="btn-ghost text-sm" onClick={generateSchema} disabled={busy !== null}>
                      🏷️ Schema.org
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* FULL ARTICLE */}
          {tab === "article" && (
            <div>
              {busy === "writing" && <div className="text-ink-500">AI tam yazıyı üretiyor… (~30-60 sn, 1500+ kelime)</div>}
              {markdown ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-ink-500">{markdown.length} karakter · ~{Math.round(markdown.split(/\s+/).length)} kelime</div>
                    <button className="btn-ghost text-xs" onClick={() => copy(markdown)}>📋 Markdown'ı kopyala</button>
                  </div>
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-ink-50/50 p-4 rounded border border-ink-200 max-h-[60vh] overflow-y-auto">{markdown}</pre>
                </div>
              ) : !busy && (
                <button className="btn-primary text-sm" onClick={writeFullArticle}>✍️ Tam Yazıyı Üret</button>
              )}
            </div>
          )}

          {/* SOCIAL */}
          {tab === "social" && (
            <div className="space-y-4 text-sm">
              {busy === "social" && <div className="text-ink-500">AI sosyal medya paketini hazırlıyor…</div>}
              {social && (
                <>
                  <Section title="Instagram Caption" body={social.instagram_caption} copy />
                  {social.instagram_hashtags?.length > 0 && (
                    <div>
                      <div className="label mb-1">Hashtag'ler</div>
                      <div className="flex flex-wrap gap-1">
                        {social.instagram_hashtags.map((h, i) => (
                          <span key={i} className="badge badge-cat">#{h.replace(/^#/, "")}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <Section title="Reels / Shorts Senaryo" body={social.reels_script} copy />
                  {social.twitter_thread?.length > 0 && (
                    <div>
                      <div className="label mb-1">X / Twitter Thread</div>
                      <div className="space-y-1.5">
                        {social.twitter_thread.map((t, i) => (
                          <div key={i} className="p-2.5 rounded bg-ink-50 border border-ink-100">
                            <div className="text-xs text-ink-500 mb-1">{i + 1}/{social.twitter_thread.length}</div>
                            <div>{t}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <Section title="LinkedIn Post" body={social.linkedin_post} copy />
                  <Section title="E-posta Konusu" body={social.email_subject} copy />
                </>
              )}
              {!social && !busy && (
                <button className="btn-primary text-sm" onClick={generateSocial}>📱 Sosyal Medya Paketi Üret</button>
              )}
            </div>
          )}

          {/* COVER IMAGE */}
          {tab === "image" && (
            <div className="space-y-3">
              {busy === "image" && <div className="text-ink-500 text-sm">DALL-E kapak görseli üretiyor… (~15-30 sn)</div>}
              {coverImage ? (
                <>
                  <img src={coverImage} alt={keyword} className="w-full rounded border border-ink-200" />
                  <div className="flex gap-2">
                    <a href={coverImage} target="_blank" rel="noreferrer" className="btn-ghost text-sm">
                      🔗 Görseli aç
                    </a>
                    <button className="btn-ghost text-sm" onClick={() => copy(coverImage)}>
                      📋 URL kopyala
                    </button>
                    <button className="btn-primary text-sm" onClick={generateCover} disabled={busy !== null}>
                      🔄 Yeniden üret
                    </button>
                  </div>
                  <p className="text-xs text-ink-500">
                    Görsel OpenAI/Azure CDN'inde 1-2 saat tutulur. Kalıcı saklamak için indir veya Yayınla'da otomatik feature image olarak kullan.
                  </p>
                </>
              ) : !busy && (
                <button className="btn-primary text-sm" onClick={generateCover}>
                  🎨 DALL-E ile Kapak Görseli Üret
                </button>
              )}
            </div>
          )}

          {/* SCHEMA */}
          {tab === "schema" && (
            <div className="space-y-3">
              {busy === "schema" && <div className="text-ink-500 text-sm">Schema üretiliyor…</div>}
              {schemaData ? (
                <>
                  <p className="text-xs text-ink-500">
                    Aşağıdaki JSON-LD'yi blog post'unuzun &lt;head&gt; içine veya page.tsx'e &lt;Script type="application/ld+json"&gt; olarak ekleyin.
                  </p>
                  <SchemaBlock label="Article" data={schemaData.article} />
                  {schemaData.faq && <SchemaBlock label="FAQ Page" data={schemaData.faq} />}
                  {schemaData.howto && <SchemaBlock label="HowTo" data={schemaData.howto} />}
                </>
              ) : !busy && (
                <button className="btn-primary text-sm" onClick={generateSchema}>🏷️ Schema.org JSON-LD Üret</button>
              )}
            </div>
          )}

          {/* PUBLISH */}
          {tab === "publish" && (
            <div className="space-y-4">
              {!markdown && (
                <div className="card card-pad bg-amber-50/40 border-amber-100 text-sm">
                  Yayınlamak için önce <strong>"Tam Yazı"</strong> tab'ından markdown'u üret.
                </div>
              )}

              {markdown && publishResult ? (
                <div className="card card-pad bg-emerald-50/40 border-emerald-100">
                  <h3 className="font-medium text-ink-900 mb-2">✓ Yayınlandı ({publishResult.platform})</h3>
                  <div className="space-y-1 text-sm">
                    <a href={publishResult.link} target="_blank" rel="noreferrer" className="block text-brand-700 hover:underline">
                      🔗 {publishResult.link}
                    </a>
                    <a href={publishResult.edit_link} target="_blank" rel="noreferrer" className="block text-ink-500 text-xs hover:underline">
                      ✏️ Editöre git
                    </a>
                  </div>
                </div>
              ) : markdown && (
                <div className="space-y-3">
                  <p className="text-sm text-ink-700">
                    Yazıyı CMS'e gönder. Önce <strong>Ayarlar → API Anahtarları → CMS</strong> bölümünden bağlantıyı yapılandır.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="card card-pad">
                      <h4 className="font-medium text-ink-900 mb-2">WordPress</h4>
                      <div className="flex gap-2">
                        <button className="btn-ghost text-xs" onClick={() => publish("wordpress", "draft")} disabled={busy !== null}>
                          📝 Taslak gönder
                        </button>
                        <button className="btn-primary text-xs" onClick={() => publish("wordpress", "publish")} disabled={busy !== null}>
                          🚀 Yayınla
                        </button>
                      </div>
                    </div>
                    <div className="card card-pad">
                      <h4 className="font-medium text-ink-900 mb-2">Ghost</h4>
                      <div className="flex gap-2">
                        <button className="btn-ghost text-xs" onClick={() => publish("ghost", "draft")} disabled={busy !== null}>
                          📝 Taslak gönder
                        </button>
                        <button className="btn-primary text-xs" onClick={() => publish("ghost", "publish")} disabled={busy !== null}>
                          🚀 Yayınla
                        </button>
                      </div>
                    </div>
                  </div>
                  {busy === "publish" && <div className="text-sm text-ink-500">CMS'e gönderiliyor…</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SchemaBlock({ label, data }: { label: string; data: any }) {
  const json = JSON.stringify(data, null, 2);
  const tag = `<script type="application/ld+json">\n${json}\n</script>`;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="label">{label}</div>
        <button onClick={() => navigator.clipboard.writeText(tag)} className="text-xs text-ink-500 hover:text-brand-700">
          📋 &lt;script&gt; ile kopyala
        </button>
      </div>
      <pre className="text-[10px] font-mono bg-ink-50/70 p-3 rounded border border-ink-200 max-h-[200px] overflow-y-auto">{json}</pre>
    </div>
  );
}

function Section({ title, body, copy }: { title: string; body: string; copy?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="label">{title}</div>
        {copy && (
          <button onClick={() => navigator.clipboard.writeText(body)} className="text-xs text-ink-500 hover:text-brand-700">
            📋 Kopyala
          </button>
        )}
      </div>
      <div className="text-ink-900 mt-0.5">{body}</div>
    </div>
  );
}
