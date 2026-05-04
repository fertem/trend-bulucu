"use client";

import { useState } from "react";
import { api, ArticleOutline, SocialPack, SEOScorecard, InternalLinkSuggestion } from "@/lib/api";
import { useT } from "@/lib/i18n";

type Phase = "outline" | "writing" | "social" | "image" | "schema" | "publish" | "edit" | "score" | "links" | "done";

export function ArticleWriter({ keyword, category, onClose }: {
  keyword: string;
  category?: string | null;
  onClose: () => void;
}) {
  const t = useT();
  const [outline, setOutline] = useState<ArticleOutline | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [social, setSocial] = useState<SocialPack | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [schemaData, setSchemaData] = useState<{ article: any; faq: any | null; howto: any | null } | null>(null);
  const [publishResult, setPublishResult] = useState<{ link: string; edit_link: string; platform: string } | null>(null);
  const [scorecard, setScorecard] = useState<SEOScorecard | null>(null);
  const [internalLinks, setInternalLinks] = useState<{ suggestions: InternalLinkSuggestion[]; message?: string } | null>(null);
  const [editInstruction, setEditInstruction] = useState("");
  const [editHistory, setEditHistory] = useState<{ instruction: string; summary: string }[]>([]);
  const [tab, setTab] = useState<"outline" | "article" | "edit" | "score" | "links" | "social" | "image" | "schema" | "publish">("outline");
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

  const editArticle = async () => {
    if (!markdown || !editInstruction.trim()) return;
    setBusy("edit");
    setError(null);
    try {
      const r = await api.articleEdit(markdown, editInstruction.trim());
      setMarkdown(r.markdown);
      setEditHistory([...editHistory, { instruction: editInstruction.trim(), summary: r.summary }]);
      setEditInstruction("");
      // Skor varsa tazele
      setScorecard(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const computeScorecard = async () => {
    if (!markdown || !outline) return;
    setBusy("score");
    setError(null);
    setTab("score");
    try {
      const r = await api.articleScorecard(keyword, markdown, outline);
      setScorecard(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const findInternalLinks = async () => {
    if (!markdown) return;
    setBusy("links");
    setError(null);
    setTab("links");
    try {
      const r = await api.articleInternalLinks(keyword, markdown);
      setInternalLinks(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const publish = async (platform: "wordpress" | "ghost", status: "draft" | "publish") => {
    if (!outline || !markdown) {
      setError(t.articleWriter.common.generateFullFirst);
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
      alert(t.articleWriter.common.copied);
    } catch {
      alert(t.articleWriter.common.copyFail);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-ink-200 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-ink-500 uppercase tracking-wide">{t.articleWriter.overline}</div>
            <h3 className="text-lg font-semibold text-ink-900 mt-0.5">{keyword}</h3>
            {category && <span className="badge badge-cat mt-1">{category}</span>}
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900 text-xl leading-none">×</button>
        </div>

        <div className="flex gap-1 px-6 pt-3 border-b border-ink-100 bg-ink-50/30 overflow-x-auto">
          {([
            ["outline", t.articleWriter.tabs.brief],
            ["article", t.articleWriter.tabs.article],
            ["edit", t.articleWriter.tabs.edit],
            ["score", t.articleWriter.tabs.score],
            ["links", t.articleWriter.tabs.links],
            ["social", t.articleWriter.tabs.social],
            ["image", t.articleWriter.tabs.image],
            ["schema", t.articleWriter.tabs.schema],
            ["publish", t.articleWriter.tabs.publish],
          ] as [typeof tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`text-xs px-3 py-1.5 rounded-t-md whitespace-nowrap ${
                tab === key ? "bg-white text-brand-700 border border-ink-200 border-b-white -mb-px font-medium" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && <div className="text-sm text-red-600 mb-3">{t.common.error}: {error}</div>}

          {/* OUTLINE / BRIEF */}
          {tab === "outline" && (
            <div className="space-y-4 text-sm">
              {busy === "outline" && <div className="text-ink-500">{t.articleWriter.brief.generating}</div>}
              {outline && (
                <>
                  <Section title={t.articleWriter.brief.title} body={outline.title} copy />
                  <Section title={t.articleWriter.brief.slug} body={outline.slug} copy />
                  <Section title={t.articleWriter.brief.meta} body={outline.meta_description} copy />
                  <Section title={t.articleWriter.brief.h1} body={outline.h1} />
                  <Section title={t.articleWriter.brief.intro} body={outline.intro_hook} />

                  {outline.outline?.length > 0 && (
                    <div>
                      <div className="label mb-1">{t.articleWriter.brief.outline} ({t.articleWriter.brief.sections(outline.outline.length)})</div>
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
                      <div className="label mb-1">{t.articleWriter.brief.faq}</div>
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
                      <div className="label mb-1">{t.articleWriter.brief.secondaryKeywords}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {outline.secondary_keywords.map((k, i) => (
                          <span key={i} className="badge badge-cat">{k}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-ink-500">{t.articleWriter.brief.estLength} {outline.estimated_word_count || "~"} {t.articleWriter.brief.words}</div>

                  <div className="flex gap-2 pt-2 flex-wrap">
                    <button className="btn-primary text-sm" onClick={writeFullArticle} disabled={busy !== null}>
                      {t.articleWriter.brief.writeFull}
                    </button>
                    <button className="btn-ghost text-sm" onClick={generateSocial} disabled={busy !== null}>
                      {t.articleWriter.brief.social}
                    </button>
                    <button className="btn-ghost text-sm" onClick={generateCover} disabled={busy !== null}>
                      {t.articleWriter.brief.cover}
                    </button>
                    <button className="btn-ghost text-sm" onClick={generateSchema} disabled={busy !== null}>
                      {t.articleWriter.brief.schema}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* FULL ARTICLE */}
          {tab === "article" && (
            <div>
              {busy === "writing" && <div className="text-ink-500">{t.articleWriter.article.generating}</div>}
              {markdown ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-ink-500">{markdown.length} {t.articleWriter.article.chars} · ~{Math.round(markdown.split(/\s+/).length)} {t.articleWriter.article.words}</div>
                    <button className="btn-ghost text-xs" onClick={() => copy(markdown)}>{t.articleWriter.article.copyMarkdown}</button>
                  </div>
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-ink-50/50 p-4 rounded border border-ink-200 max-h-[60vh] overflow-y-auto">{markdown}</pre>
                </div>
              ) : !busy && (
                <button className="btn-primary text-sm" onClick={writeFullArticle}>{t.articleWriter.article.writeFull}</button>
              )}
            </div>
          )}

          {/* SOCIAL */}
          {tab === "social" && (
            <div className="space-y-4 text-sm">
              {busy === "social" && <div className="text-ink-500">{t.articleWriter.social.generating}</div>}
              {social && (
                <>
                  <Section title={t.articleWriter.social.igCaption} body={social.instagram_caption} copy />
                  {social.instagram_hashtags?.length > 0 && (
                    <div>
                      <div className="label mb-1">{t.articleWriter.social.hashtags}</div>
                      <div className="flex flex-wrap gap-1">
                        {social.instagram_hashtags.map((h, i) => (
                          <span key={i} className="badge badge-cat">#{h.replace(/^#/, "")}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <Section title={t.articleWriter.social.reels} body={social.reels_script} copy />
                  {social.twitter_thread?.length > 0 && (
                    <div>
                      <div className="label mb-1">{t.articleWriter.social.thread}</div>
                      <div className="space-y-1.5">
                        {social.twitter_thread.map((tw, i) => (
                          <div key={i} className="p-2.5 rounded bg-ink-50 border border-ink-100">
                            <div className="text-xs text-ink-500 mb-1">{i + 1}/{social.twitter_thread.length}</div>
                            <div>{tw}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <Section title={t.articleWriter.social.linkedin} body={social.linkedin_post} copy />
                  <Section title={t.articleWriter.social.email} body={social.email_subject} copy />
                </>
              )}
              {!social && !busy && (
                <button className="btn-primary text-sm" onClick={generateSocial}>{t.articleWriter.social.generate}</button>
              )}
            </div>
          )}

          {/* EDIT */}
          {tab === "edit" && (
            <div className="space-y-3">
              {!markdown ? (
                <div className="card card-pad bg-amber-50/40 border-amber-100 text-sm">
                  {t.articleWriter.edit.generateFirst}
                </div>
              ) : (
                <>
                  <p className="text-xs text-ink-500">{t.articleWriter.edit.hint}</p>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      placeholder={t.articleWriter.edit.placeholder}
                      value={editInstruction}
                      onChange={(e) => setEditInstruction(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") editArticle(); }}
                      disabled={busy !== null}
                    />
                    <button className="btn-primary text-sm" onClick={editArticle} disabled={busy !== null || !editInstruction.trim()}>
                      {busy === "edit" ? t.articleWriter.edit.applying : t.articleWriter.edit.apply}
                    </button>
                  </div>

                  <div className="text-xs text-ink-500">{t.articleWriter.edit.quickTemplates}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.articleWriter.edit.tpl.map((s) => (
                      <button
                        key={s}
                        onClick={() => setEditInstruction(s)}
                        className="text-xs px-2 py-0.5 rounded border border-ink-200 hover:bg-ink-50"
                        disabled={busy !== null}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {editHistory.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-ink-100">
                      <div className="label mb-2">{t.articleWriter.edit.history}</div>
                      <div className="space-y-2">
                        {editHistory.map((h, i) => (
                          <div key={i} className="text-xs border-l-2 border-brand-200 pl-3 py-1">
                            <div className="text-ink-700"><strong>→</strong> {h.instruction}</div>
                            {h.summary && <div className="text-ink-500 mt-0.5 whitespace-pre-wrap">{h.summary}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-ink-100">
                    <div className="label mb-1">{t.articleWriter.edit.currentMd} ({markdown.split(/\s+/).length} {t.articleWriter.article.words})</div>
                    <pre className="text-[10px] font-mono bg-ink-50/70 p-3 rounded border border-ink-200 max-h-[300px] overflow-y-auto">
                      {markdown.slice(0, 1500)}{markdown.length > 1500 && "\n\n…"}
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SCORE */}
          {tab === "score" && (
            <div className="space-y-3">
              {!markdown ? (
                <div className="card card-pad bg-amber-50/40 border-amber-100 text-sm">
                  {t.articleWriter.score.generateFirst}
                </div>
              ) : !scorecard && !busy ? (
                <button className="btn-primary text-sm" onClick={computeScorecard}>
                  {t.articleWriter.score.compute}
                </button>
              ) : busy === "score" ? (
                <div className="text-ink-500 text-sm">{t.articleWriter.score.computing}</div>
              ) : scorecard && (
                <div className="space-y-4">
                  <div className="card card-pad bg-gradient-to-br from-brand-50/40 to-white border-brand-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-ink-500">{t.articleWriter.score.total}</div>
                        <div className="text-4xl font-semibold text-ink-900 tabular-nums">
                          {scorecard.total_score}<span className="text-base text-ink-500">/100</span>
                        </div>
                        <div className={`text-sm mt-1 ${
                          scorecard.verdict === "mükemmel" || scorecard.verdict === "excellent" ? "text-emerald-700" :
                          scorecard.verdict === "iyi" || scorecard.verdict === "good" ? "text-emerald-600" :
                          scorecard.verdict === "orta" || scorecard.verdict === "average" ? "text-amber-700" : "text-red-600"
                        }`}>
                          {scorecard.verdict.toUpperCase()}
                        </div>
                      </div>
                      <button className="btn-ghost text-xs" onClick={computeScorecard}>{t.articleWriter.score.recompute}</button>
                    </div>
                  </div>

                  <div>
                    <div className="label mb-2">{t.articleWriter.score.breakdown}</div>
                    <div className="space-y-1.5">
                      {Object.entries(scorecard.breakdown).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2">
                          <div className="text-xs text-ink-700 w-40 capitalize">{k.replace(/_/g, " ")}</div>
                          <div className="flex-1 h-2 bg-ink-100 rounded overflow-hidden">
                            <div
                              className={`h-full ${v >= 80 ? "bg-emerald-500" : v >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${v}%` }}
                            />
                          </div>
                          <div className="text-xs text-ink-700 tabular-nums w-10 text-right">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="label mb-2">{t.articleWriter.score.metrics}</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <Metric label={t.articleWriter.score.mWordCount} value={scorecard.metrics.word_count.toString()} />
                      <Metric label={t.articleWriter.score.mTargetKw} value={`${scorecard.metrics.keyword_count}× (%${scorecard.metrics.keyword_density_pct})`} />
                      <Metric label={t.articleWriter.score.mHeadings} value={`${scorecard.metrics.h2_count} / ${scorecard.metrics.h3_count}`} />
                      <Metric label={t.articleWriter.score.mFirstPara} value={scorecard.metrics.keyword_in_first_para ? t.articleWriter.score.yes : t.articleWriter.score.no} />
                      <Metric label={t.articleWriter.score.mInHeadings} value={`${scorecard.metrics.keyword_in_headings} ${t.articleWriter.score.times}`} />
                      <Metric label={t.articleWriter.score.mEngagement} value={`${scorecard.metrics.has_lists ? "L" : "-"}${scorecard.metrics.has_bold ? "B" : "-"}${scorecard.metrics.has_questions ? "?" : "-"}`} />
                    </div>
                  </div>

                  {scorecard.issues.length > 0 && (
                    <div className="card card-pad bg-amber-50/30 border-amber-100">
                      <div className="label mb-2">{t.articleWriter.score.issues}</div>
                      <ul className="space-y-1 text-sm text-ink-700">
                        {scorecard.issues.map((i, idx) => <li key={idx}>⚠️ {i}</li>)}
                      </ul>
                      {scorecard.suggestions.length > 0 && (
                        <>
                          <div className="label mt-3 mb-2">{t.articleWriter.score.aiSuggestions}</div>
                          <ul className="space-y-1 text-sm text-emerald-800">
                            {scorecard.suggestions.map((s, idx) => <li key={idx}>💡 {s}</li>)}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* INTERNAL LINKS */}
          {tab === "links" && (
            <div className="space-y-3">
              {!markdown ? (
                <div className="card card-pad bg-amber-50/40 border-amber-100 text-sm">
                  {t.articleWriter.links.generateFirst}
                </div>
              ) : !internalLinks && !busy ? (
                <>
                  <p className="text-sm text-ink-500">{t.articleWriter.links.hint}</p>
                  <button className="btn-primary text-sm" onClick={findInternalLinks}>
                    {t.articleWriter.links.find}
                  </button>
                </>
              ) : busy === "links" ? (
                <div className="text-ink-500 text-sm">{t.articleWriter.links.finding}</div>
              ) : internalLinks?.message ? (
                <div className="card card-pad bg-amber-50/30 text-sm">
                  {internalLinks.message}
                </div>
              ) : internalLinks && internalLinks.suggestions.length > 0 ? (
                <div>
                  <div className="text-xs text-ink-500 mb-2">{internalLinks.suggestions.length} {t.articleWriter.links.suggestions}:</div>
                  <div className="space-y-2">
                    {internalLinks.suggestions.map((s, i) => (
                      <div key={i} className="card card-pad">
                        <div className="text-xs text-ink-500 mb-1">{t.articleWriter.links.section}: <strong>{s.section_h2}</strong></div>
                        <div className="text-sm">
                          {t.articleWriter.links.anchor}: <code className="bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded">{s.anchor_text}</code>
                        </div>
                        <div className="text-xs text-ink-500 mt-1">→ <a href={s.target_url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{s.target_slug}</a></div>
                        {s.reason && <div className="text-xs text-ink-500 italic mt-1">"{s.reason}"</div>}
                        <button
                          className="text-xs text-ink-500 hover:text-brand-700 mt-2"
                          onClick={() => copy(`[${s.anchor_text}](${s.target_url})`)}
                        >
                          {t.articleWriter.links.copyMd}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-ink-500">{t.articleWriter.links.empty}</div>
              )}
            </div>
          )}

          {/* COVER IMAGE */}
          {tab === "image" && (
            <div className="space-y-3">
              {busy === "image" && <div className="text-ink-500 text-sm">{t.articleWriter.image.generating}</div>}
              {coverImage ? (
                <>
                  <img src={coverImage} alt={keyword} className="w-full rounded border border-ink-200" />
                  <div className="flex gap-2">
                    <a href={coverImage} target="_blank" rel="noreferrer" className="btn-ghost text-sm">
                      {t.articleWriter.image.open}
                    </a>
                    <button className="btn-ghost text-sm" onClick={() => copy(coverImage)}>
                      {t.articleWriter.image.copyUrl}
                    </button>
                    <button className="btn-primary text-sm" onClick={generateCover} disabled={busy !== null}>
                      {t.articleWriter.image.regenerate}
                    </button>
                  </div>
                  <p className="text-xs text-ink-500">{t.articleWriter.image.hint}</p>
                </>
              ) : !busy && (
                <button className="btn-primary text-sm" onClick={generateCover}>
                  {t.articleWriter.image.generate}
                </button>
              )}
            </div>
          )}

          {/* SCHEMA */}
          {tab === "schema" && (
            <div className="space-y-3">
              {busy === "schema" && <div className="text-ink-500 text-sm">{t.articleWriter.schema.generating}</div>}
              {schemaData ? (
                <>
                  <p className="text-xs text-ink-500">{t.articleWriter.schema.hint}</p>
                  <SchemaBlock label="Article" data={schemaData.article} />
                  {schemaData.faq && <SchemaBlock label="FAQ Page" data={schemaData.faq} />}
                  {schemaData.howto && <SchemaBlock label="HowTo" data={schemaData.howto} />}
                </>
              ) : !busy && (
                <button className="btn-primary text-sm" onClick={generateSchema}>{t.articleWriter.schema.generate}</button>
              )}
            </div>
          )}

          {/* PUBLISH */}
          {tab === "publish" && (
            <div className="space-y-4">
              {!markdown && (
                <div className="card card-pad bg-amber-50/40 border-amber-100 text-sm">
                  {t.articleWriter.publish.needArticle}
                </div>
              )}

              {markdown && publishResult ? (
                <div className="card card-pad bg-emerald-50/40 border-emerald-100">
                  <h3 className="font-medium text-ink-900 mb-2">{t.articleWriter.publish.published} ({publishResult.platform})</h3>
                  <div className="space-y-1 text-sm">
                    <a href={publishResult.link} target="_blank" rel="noreferrer" className="block text-brand-700 hover:underline">
                      🔗 {publishResult.link}
                    </a>
                    <a href={publishResult.edit_link} target="_blank" rel="noreferrer" className="block text-ink-500 text-xs hover:underline">
                      {t.articleWriter.publish.editorLink}
                    </a>
                  </div>
                </div>
              ) : markdown && (
                <div className="space-y-3">
                  <p className="text-sm text-ink-700">{t.articleWriter.publish.hint}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="card card-pad">
                      <h4 className="font-medium text-ink-900 mb-2">WordPress</h4>
                      <div className="flex gap-2">
                        <button className="btn-ghost text-xs" onClick={() => publish("wordpress", "draft")} disabled={busy !== null}>
                          {t.articleWriter.publish.draft}
                        </button>
                        <button className="btn-primary text-xs" onClick={() => publish("wordpress", "publish")} disabled={busy !== null}>
                          {t.articleWriter.publish.go}
                        </button>
                      </div>
                    </div>
                    <div className="card card-pad">
                      <h4 className="font-medium text-ink-900 mb-2">Ghost</h4>
                      <div className="flex gap-2">
                        <button className="btn-ghost text-xs" onClick={() => publish("ghost", "draft")} disabled={busy !== null}>
                          {t.articleWriter.publish.draft}
                        </button>
                        <button className="btn-primary text-xs" onClick={() => publish("ghost", "publish")} disabled={busy !== null}>
                          {t.articleWriter.publish.go}
                        </button>
                      </div>
                    </div>
                  </div>
                  {busy === "publish" && <div className="text-sm text-ink-500">{t.articleWriter.publish.sending}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-500">{label}</div>
      <div className="text-sm font-medium text-ink-900 tabular-nums">{value}</div>
    </div>
  );
}

function SchemaBlock({ label, data }: { label: string; data: any }) {
  const t = useT();
  const json = JSON.stringify(data, null, 2);
  const tag = `<script type="application/ld+json">\n${json}\n</script>`;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="label">{label}</div>
        <button onClick={() => navigator.clipboard.writeText(tag)} className="text-xs text-ink-500 hover:text-brand-700">
          {t.articleWriter.schema.copyScript}
        </button>
      </div>
      <pre className="text-[10px] font-mono bg-ink-50/70 p-3 rounded border border-ink-200 max-h-[200px] overflow-y-auto">{json}</pre>
    </div>
  );
}

function Section({ title, body, copy }: { title: string; body: string; copy?: boolean }) {
  const t = useT();
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="label">{title}</div>
        {copy && (
          <button onClick={() => navigator.clipboard.writeText(body)} className="text-xs text-ink-500 hover:text-brand-700">
            {t.articleWriter.common.copy}
          </button>
        )}
      </div>
      <div className="text-ink-900 mt-0.5">{body}</div>
    </div>
  );
}
