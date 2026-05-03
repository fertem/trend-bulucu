const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TOKEN_KEY = "trend-bulucu-token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = data.detail || msg;
    } catch {}
    if (res.status === 401 && typeof window !== "undefined") {
      clearToken();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return (await res.text()) as unknown as T;
}

export const api = {
  fetcher: <T = unknown>(path: string) => request<T>(path),

  login: (username: string, password: string) =>
    request<{ access_token: string; expires_in_hours: number; has_ai: boolean }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ username, password }) }
    ),

  publicConfig: () => request<{ has_ai: boolean }>("/api/auth/config"),

  overview: () => request<OverviewResponse>("/api/trends/overview"),
  keyword: (kw: string) =>
    request<KeywordDetailResponse>(`/api/trends/keyword/${encodeURIComponent(kw)}`),
  keywords: () => request<KeywordItem[]>("/api/trends/keywords"),
  opportunities: (limit = 20) => request<TrendScore[]>(`/api/trends/opportunities?limit=${limit}`),
  categories: () => request<Record<string, TrendScore[]>>("/api/trends/categories"),
  alerts: () => request<TrendScore[]>("/api/trends/alerts"),
  exportCsvUrl: () => `${API}/api/trends/export.csv`,

  triggerCollect: () => request<{ status: string; message: string }>("/api/admin/collect", { method: "POST" }),
  recomputeScores: () => request<{ recomputed: number }>("/api/admin/recompute-scores", { method: "POST" }),
  refreshVolumes: (force = false) =>
    request<{ status: string; updated?: number; error?: string }>(
      `/api/admin/refresh-volumes${force ? "?force=true" : ""}`,
      { method: "POST" }
    ),
  adsStatus: () => request<{ configured: boolean }>("/api/admin/ads-status"),
  runs: () => request<RunItem[]>("/api/admin/runs"),

  // Seasonality (5y historical)
  collectHistorical: () =>
    request<{ status: string; message: string }>("/api/admin/collect-historical", { method: "POST" }),
  historicalRuns: () => request<RunItem[]>("/api/admin/historical-runs"),
  seasonalityStatus: () => request<{ has_data: boolean }>("/api/seasonality/status"),
  monthlyOutlook: (month?: number) =>
    request<MonthlyOutlook>(`/api/seasonality/outlook${month ? `?month=${month}` : ""}`),
  keywordProfile: (kw: string) =>
    request<Record<string, MonthProfile | null>>(`/api/seasonality/keyword/${encodeURIComponent(kw)}/profile`),
  keywordYoY: (kw: string) =>
    request<YoYPoint[]>(`/api/seasonality/keyword/${encodeURIComponent(kw)}/yoy`),
  keywordVsHistory: (kw: string, month?: number) =>
    request<VsHistoryResponse>(
      `/api/seasonality/keyword/${encodeURIComponent(kw)}/this-vs-history${month ? `?month=${month}` : ""}`
    ),
  seasonalOutlookAI: (month?: number) =>
    request<SeasonalOutlookAI>("/api/ai/seasonal-outlook" + (month ? `?month=${month}` : ""), {
      method: "POST",
    }),
  researchKeyword: (keyword: string, add_to_tracking = false) =>
    request<ResearchResponse>("/api/seasonality/research", {
      method: "POST",
      body: JSON.stringify({ keyword, add_to_tracking }),
    }),

  // Site coverage / content gaps
  contentStatus: () => request<{ configured: boolean; kod_org_path: string; content_count: number }>("/api/content/status"),
  scanContent: () => request<{ status: string; total: number; blog: number; page: number; added: number; updated: number; removed: number }>("/api/content/scan", { method: "POST" }),
  systemFreshness: () => request<SystemFreshness>("/api/system/freshness"),
  systemRefreshAll: () =>
    request<{ status: string; message: string }>("/api/system/refresh-all", { method: "POST" }),
  systemSetupStatus: () => request<SetupStatus>("/api/system/setup-status"),

  // AI Chat
  aiChat: (messages: { role: "user" | "assistant"; content: string }[]) =>
    request<{ role: string; content: string }>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
    }),

  // Search Intent + KD + PAA
  aiSearchIntent: (keywords: string[]) =>
    request<{ items: { keyword: string; intent: string; confidence: number; reasoning: string }[] }>(
      "/api/ai/search-intent",
      { method: "POST", body: JSON.stringify({ keywords }) }
    ),
  aiKeywordDifficulty: (keyword: string, category?: string) =>
    request<KDResult>("/api/ai/keyword-difficulty", {
      method: "POST",
      body: JSON.stringify({ keyword, category }),
    }),
  aiPAA: (keyword: string, count = 20) =>
    request<{ questions: PAAQuestion[]; topic_clusters: string[] }>("/api/ai/paa", {
      method: "POST",
      body: JSON.stringify({ keyword, count }),
    }),

  // Article: Edit + Scorecard + Internal Links
  articleEdit: (markdown: string, instruction: string) =>
    request<{ markdown: string; summary: string; length: number; word_count: number }>(
      "/api/ai/article/edit",
      { method: "POST", body: JSON.stringify({ markdown, instruction }) }
    ),
  articleScorecard: (keyword: string, markdown: string, outline?: any) =>
    request<SEOScorecard>("/api/ai/article/scorecard", {
      method: "POST",
      body: JSON.stringify({ keyword, markdown, outline }),
    }),
  articleInternalLinks: (keyword: string, markdown: string) =>
    request<{ suggestions: InternalLinkSuggestion[]; message?: string }>(
      "/api/ai/article/internal-links",
      { method: "POST", body: JSON.stringify({ keyword, markdown }) }
    ),

  // DALL-E cover image
  aiCoverImage: (keyword: string, prompt_hint = "", style = "modern, minimalist, vibrant") =>
    request<{ url: string; keyword: string }>("/api/ai/cover-image", {
      method: "POST",
      body: JSON.stringify({ keyword, prompt_hint, style }),
    }),

  // Schema.org
  aiSchema: (keyword: string, outline: any) =>
    request<{ article: any; faq: any | null; howto: any | null }>("/api/ai/schema", {
      method: "POST",
      body: JSON.stringify({ keyword, outline }),
    }),

  // Refresh existing post
  aiRefreshPost: (slug: string, title: string, keyword: string) =>
    request<RefreshSuggestion>("/api/ai/refresh-post", {
      method: "POST",
      body: JSON.stringify({ slug, title, keyword }),
    }),

  // Topic clusters + authority + cannibalization
  buildClusters: () => request<{ clusters: TopicCluster[] }>("/api/ai/clusters/build", { method: "POST" }),
  getClusters: () => request<{ clusters: TopicCluster[] }>("/api/ai/clusters"),
  topicAuthority: () => request<{ clusters: AuthorityScore[]; message?: string }>("/api/ai/topic-authority"),
  cannibalization: () => request<{ items: CannibalItem[]; message?: string }>("/api/ai/cannibalization"),

  // Publishing
  publishStatus: () =>
    request<{ wordpress: { configured: boolean; site_url: string }; ghost: { configured: boolean; site_url: string } }>(
      "/api/publish/status"
    ),
  publishTest: (platform: "wordpress" | "ghost") =>
    request<{ ok: boolean; user?: string; title?: string; error?: string }>("/api/publish/test", {
      method: "POST",
      body: JSON.stringify({ platform }),
    }),
  publishPost: (params: PublishParams) =>
    request<{ ok: boolean; platform: string; id: number; link: string; status: string; edit_link: string }>(
      "/api/publish/post",
      { method: "POST", body: JSON.stringify(params) }
    ),
  publishConfig: (params: { platform: "wordpress" | "ghost"; site_url: string; username?: string; app_password?: string; admin_api_key?: string }) =>
    request<{ ok: boolean }>("/api/publish/config", { method: "PUT", body: JSON.stringify(params) }),

  // Settings
  getSettings: () => request<{ settings: AppSettings; configured: boolean }>("/api/settings"),
  updateSettings: (updates: Partial<AppSettings>) =>
    request<{ settings: AppSettings; configured: boolean }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ updates }),
    }),
  markConfigured: () =>
    request<{ configured: boolean }>("/api/settings/mark-configured", { method: "POST" }),
  listCats: () => request<CategoryItem[]>("/api/settings/categories"),
  addCat: (name: string, triggers: string, color?: string) =>
    request<CategoryItem>("/api/settings/categories", {
      method: "POST",
      body: JSON.stringify({ name, triggers, color }),
    }),
  removeCat: (id: number) =>
    request<{ removed: boolean }>(`/api/settings/categories/${id}`, { method: "DELETE" }),
  loadCatTemplate: (template: string) =>
    request<{ added: number; template: string }>("/api/settings/categories/load-template", {
      method: "POST",
      body: JSON.stringify({ template }),
    }),
  catTemplates: () => request<Record<string, { name: string; triggers: string }[]>>("/api/settings/category-templates"),
  getEnv: () => request<{ items: Record<string, EnvItem> }>("/api/settings/env"),
  updateEnv: (updates: Record<string, string>) =>
    request<{ written: string[]; skipped: string[]; note: string }>("/api/settings/env", {
      method: "PUT",
      body: JSON.stringify({ updates }),
    }),

  // Setup wizard AI
  aiDetectIndustry: (brand_name: string, brand_description: string, brand_url = "") =>
    request<{ industry: string; industry_label: string; category_template: string; default_audience: string; rationale: string }>(
      "/api/ai/setup/detect-industry",
      { method: "POST", body: JSON.stringify({ brand_name, brand_description, brand_url }) }
    ),
  aiSuggestKeywords: (brand_name: string, brand_description: string, target_audience = "", count = 15) =>
    request<{ keywords: { keyword: string; type: string; reason: string }[] }>(
      "/api/ai/setup/suggest-keywords",
      { method: "POST", body: JSON.stringify({ brand_name, brand_description, target_audience, count }) }
    ),
  aiSuggestCategories: (brand_name: string, brand_description: string) =>
    request<{ categories: { name: string; triggers: string; reason: string }[] }>(
      "/api/ai/setup/suggest-categories",
      { method: "POST", body: JSON.stringify({ brand_name, brand_description, brand_url: "" }) }
    ),

  // AI Discovery Pipeline (suggest → trends → compare → rank)
  aiDiscovery: (count = 10, fetch_trends = true, compare_with_site = true) =>
    request<{ items: DiscoveryItem[]; brand: string; message?: string }>("/api/ai/discovery", {
      method: "POST",
      body: JSON.stringify({ count, fetch_trends, compare_with_site }),
    }),

  // Article writer
  articleOutline: (keyword: string, category?: string) =>
    request<ArticleOutline>("/api/ai/article/outline", {
      method: "POST",
      body: JSON.stringify({ keyword, category }),
    }),
  articleWrite: (keyword: string, outline: any, tone = "bilgilendirici, sıcak, satıcı değil") =>
    request<{ keyword: string; markdown: string; length: number }>("/api/ai/article/write", {
      method: "POST",
      body: JSON.stringify({ keyword, outline, tone }),
    }),
  articleSocial: (keyword: string, outline: any) =>
    request<SocialPack>("/api/ai/article/social", {
      method: "POST",
      body: JSON.stringify({ keyword, outline }),
    }),

  // Search Console
  scStatus: () => request<SCStatus>("/api/sc/status"),
  scListSites: () => request<{ sites: { url: string; permission: string }[] }>("/api/sc/list-sites"),
  scSetSite: (site_url: string) =>
    request<{ status: string; site_url: string; note: string }>("/api/sc/set-site", {
      method: "POST",
      body: JSON.stringify({ site_url }),
    }),
  scSync: (days = 28) =>
    request<{ status: string; imported?: number; period_start?: string; period_end?: string; error?: string }>(
      `/api/sc/sync?days=${days}`,
      { method: "POST" }
    ),
  scQueries: (limit = 25) => request<SCQuery[]>(`/api/sc/queries?limit=${limit}`),
  scOpportunities: (limit = 25) => request<SCOpportunity[]>(`/api/sc/opportunities?limit=${limit}`),
  scPage2: (limit = 25) => request<SCQuery[]>(`/api/sc/page2?limit=${limit}`),
  scMovers: (limit = 25) => request<SCMover[]>(`/api/sc/movers?limit=${limit}`),

  contentGaps: (status: string = "all", limit = 100) =>
    request<ContentGap[]>(`/api/content/gaps?status=${status}&limit=${limit}`),
  contentGapsLive: (limit = 30) =>
    request<ContentGap[]>(`/api/content/gaps/live?limit=${limit}`),
  contentGapCounts: () =>
    request<{ new: number; in_progress: number; addressed: number; dismissed: number; total: number }>("/api/content/gaps/counts"),
  refreshContentGaps: () =>
    request<{ added: number; updated: number; marked_stale: number; total_in_history: number }>("/api/content/gaps/refresh", { method: "POST" }),
  setGapStatus: (id: number, status: string, addressed_url?: string, notes?: string) =>
    request<{ id: number; keyword: string; status: string }>(`/api/content/gaps/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, addressed_url, notes }),
    }),

  insight: (keyword: string) =>
    request<{ insight: string }>("/api/ai/insight", {
      method: "POST",
      body: JSON.stringify({ keyword }),
    }),
  contentIdeas: (keyword: string) =>
    request<{ ideas: string }>("/api/ai/content-ideas", {
      method: "POST",
      body: JSON.stringify({ keyword }),
    }),
  digest: () => request<DigestResponse>("/api/ai/digest", { method: "POST" }),
  suggestKeywords: () =>
    request<{ suggestions: KeywordSuggestion[] }>("/api/ai/suggest-keywords", { method: "POST" }),
  similarKeywords: (keyword: string) =>
    request<{ similar_keywords: SimilarKeyword[] }>("/api/ai/similar-keywords", {
      method: "POST",
      body: JSON.stringify({ keyword }),
    }),
  longTail: (keyword: string) =>
    request<{ variants: LongTailVariant[] }>("/api/ai/long-tail", {
      method: "POST",
      body: JSON.stringify({ keyword }),
    }),

  anomalies: () => request<AnomalyItem[]>("/api/trends/anomalies"),
  addKeywords: (keywords: string[]) =>
    request<{ added: string[]; skipped: string[] }>("/api/admin/keywords", {
      method: "POST",
      body: JSON.stringify({ keywords }),
    }),
  removeKeyword: (kw: string) =>
    request<{ removed: boolean }>(`/api/admin/keywords/${encodeURIComponent(kw)}`, { method: "DELETE" }),
};

export type TrendScore = {
  keyword: string;
  category: string | null;
  avg_last_7: number;
  avg_prev_7: number;
  growth_pct: number;
  is_hot: boolean;
  opportunity_score: number;
  computed_at: string | null;
  volume_monthly?: number | null;
  volume_recent?: number | null;
  competition?: string | null;
  competition_index?: number | null;
  bid_low?: number;
  bid_high?: number;
};

export type OverviewResponse = {
  total_keywords: number;
  hot_count: number;
  has_volumes: boolean;
  top: TrendScore[];
  rising: TrendScore[];
  alerts: TrendScore[];
};

export type KeywordItem = {
  keyword: string;
  category: string | null;
  is_seed: boolean;
  last_collected_at: string | null;
};

export type KeywordDetailResponse = {
  keyword: string;
  score: TrendScore | null;
  timeseries: { date: string; interest: number; is_partial: boolean }[];
  forecast: { date: string; predicted: number }[];
  smart_forecast: { date: string; predicted: number; confidence_low: number; confidence_high: number; seasonal_mult: number }[];
  correlated: CorrelatedKeyword[];
  anomaly: { is_anomaly: boolean; z_score: number; last_value: number; history_mean?: number };
  rising: { keyword: string; growth: number }[];
  related_top: { keyword: string; score: number }[];
};

export type CorrelatedKeyword = {
  keyword: string;
  category: string | null;
  correlation: number;
  direction: "pozitif" | "negatif";
  data_points: number;
};

export type SimilarKeyword = {
  keyword: string;
  similarity_type: string;
  reason: string;
};

export type LongTailVariant = {
  keyword: string;
  type: string;
};

export type DigestHighlight = { title: string; reason: string; keyword?: string };
export type DigestAction = { action: string; why: string; channel: string };
export type DigestResponse = {
  headline: string;
  highlights: DigestHighlight[];
  actions: DigestAction[];
  watch_out?: string;
};

export type KeywordSuggestion = {
  keyword: string;
  reason: string;
  category: string;
};

export type AnomalyItem = {
  keyword: string;
  category: string | null;
  is_anomaly: boolean;
  z_score: number;
  last_value: number;
  history_mean: number;
};

export type MonthOutlookItem = {
  keyword: string;
  category: string | null;
  month_avg: number;
  month_median: number;
  lift_pct: number;
  peak_month: number | null;
  peak_month_name: string | null;
  trough_month: number | null;
  is_seasonal_peak: boolean;
  years: { year: number; interest: number }[];
};

export type MonthlyOutlook = {
  target_month: number;
  target_month_name: string;
  by_lift: MonthOutlookItem[];
  by_volume: MonthOutlookItem[];
};

export type MonthProfile = {
  month: number;
  month_name: string;
  mean: number;
  median: number;
  p25: number;
  p75: number;
  lift_pct: number;
  years: { year: number; interest: number }[];
};

export type YoYPoint = { year: number; month: number; interest: number };

export type VsHistoryResponse = {
  keyword: string;
  target_month: number;
  target_month_name: string;
  this_year: number | null;
  last_year: number | null;
  history_5y_avg: number;
  delta_vs_history_pct: number | null;
  delta_vs_last_year_pct: number | null;
};

export type SeasonalOutlookAI = {
  month: number;
  month_name: string;
  headline: string;
  predictions: { keyword: string; what_to_expect: string; reason: string }[];
  early_movers: string;
  context: string;
};

export type ResearchResponse = {
  keyword: string;
  profile: Record<string, MonthProfile | null>;
  yoy: YoYPoint[];
  this_vs_history: VsHistoryResponse | null;
  tracking: boolean;
};

export type AppSettings = {
  brand_name: string;
  brand_url: string;
  brand_description: string;
  target_audience: string;
  industry: string;
  geo_target: string;
  language: string;
  site_path: string;
  configured: string;
};

export type CategoryItem = {
  id: number;
  name: string;
  triggers: string[];
  triggers_csv: string;
  color: string | null;
  sort_order: number;
};

export type EnvItem = {
  value: string;
  is_set: boolean;
  is_sensitive: boolean;
};

export type ArticleOutline = {
  title: string;
  slug: string;
  meta_description: string;
  h1: string;
  intro_hook: string;
  outline: { h2: string; h3: string[]; key_points: string[] }[];
  faq: { q: string; a: string }[];
  key_takeaways: string[];
  internal_link_ideas: string[];
  secondary_keywords: string[];
  estimated_word_count: number;
};

export type DiscoveryItem = {
  keyword: string;
  type: string;
  ai_reason: string;
  trend_current_month_avg: number | null;
  trend_lift_pct?: number;
  trend_peak_month?: string;
  trend_annual_avg: number | null;
  coverage_score: number;
  best_match_slug: string | null;
  best_match_url: string | null;
  suggested_action: "write" | "track" | "skip";
  action_label: string;
  priority: number;
};

export type KDResult = {
  kd_score: number;
  verdict: string;
  competition_type: string;
  winning_strategy: string;
  estimated_time_to_rank: string;
};

export type PAAQuestion = {
  question: string;
  type: string;
  search_intent: string;
  content_angle: string;
};

export type SEOScorecard = {
  total_score: number;
  verdict: string;
  breakdown: Record<string, number>;
  metrics: {
    word_count: number;
    keyword_density_pct: number;
    keyword_count: number;
    h2_count: number;
    h3_count: number;
    keyword_in_first_para: boolean;
    keyword_in_headings: number;
    has_lists: boolean;
    has_bold: boolean;
    has_questions: boolean;
  };
  issues: string[];
  suggestions: string[];
};

export type InternalLinkSuggestion = {
  section_h2: string;
  anchor_text: string;
  target_slug: string;
  target_url: string;
  reason: string;
};

export type SocialPack = {
  instagram_caption: string;
  instagram_hashtags: string[];
  reels_script: string;
  twitter_thread: string[];
  linkedin_post: string;
  email_subject: string;
};

export type RefreshSuggestion = {
  needs_refresh: boolean;
  urgency: "high" | "medium" | "low";
  reasons: string[];
  suggested_changes: { type: string; description: string; rationale: string }[];
  new_sections_to_add: string[];
  estimated_impact: string;
};

export type TopicCluster = {
  name: string;
  theme: string;
  keywords: string[];
  size: number;
};

export type AuthorityScore = {
  cluster: string;
  theme: string;
  size: number;
  covered: number;
  coverage_pct: number;
  avg_position: number | null;
  total_clicks: number;
  authority_score: number;
  verdict: "strong" | "medium" | "weak";
};

export type CannibalItem = {
  query: string;
  page_count: number;
  pages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[];
  best_position: number;
  best_page: string;
  total_impressions: number;
  total_clicks: number;
  severity: "high" | "medium";
};

export type PublishParams = {
  platform: "wordpress" | "ghost";
  title: string;
  markdown: string;
  slug?: string;
  excerpt?: string;
  feature_image?: string;
  tags?: string[];
  status?: "draft" | "publish" | "publish_now";
};

export type SetupStep = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  required: boolean;
  action_url: string;
  action_label: string;
  current_count?: number;
  target_count?: number;
  doc_link?: string;
  depends_on?: string;
};

export type SetupStatus = {
  steps: SetupStep[];
  required_done: number;
  required_total: number;
  optional_done: number;
  optional_total: number;
  fully_setup: boolean;
};

export type SystemFreshness = {
  trends_last_collected: string | null;
  trends_last_run_status: string | null;
  trends_succeeded: number;
  trends_attempted: number;
  historical_last_fetched: string | null;
  historical_succeeded: number;
  scores_last_computed: string | null;
  site_last_scanned: string | null;
  ads_volumes_last_fetched: string | null;
  gsc_last_synced: string | null;
  gsc_last_status: string | null;
  gsc_imported_rows: number;
  content_gaps_last_refresh: string | null;
};

export type SCStatus = {
  site_configured: boolean;
  site_url: string;
  row_count: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_imported: number;
};

export type SCQuery = {
  query: string;
  page: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  prev_clicks: number | null;
  prev_impressions: number | null;
  prev_position: number | null;
};

export type SCOpportunity = SCQuery & {
  expected_ctr: number;
  ctr_gap: number;
  potential_clicks: number;
};

export type SCMover = SCQuery & {
  position_delta: number;
  direction: "up" | "down";
};

export type ContentGap = {
  id?: number;
  keyword: string;
  category: string | null;
  growth_pct: number;
  avg_last_7: number;
  is_hot?: boolean;
  source: "tracked" | "rising";
  coverage_score: number;
  best_match_slug: string | null;
  best_match_title: string | null;
  best_match_url: string | null;
  is_gap?: boolean;
  priority: number;
  // History fields
  first_detected_at?: string;
  last_detected_at?: string;
  times_detected?: number;
  peak_priority?: number;
  is_currently_trending?: boolean;
  status?: "new" | "in_progress" | "addressed" | "dismissed";
  addressed_url?: string | null;
  notes?: string | null;
  addressed_at?: string | null;
};

export type RunItem = {
  id: number;
  started_at: string | null;
  finished_at: string | null;
  attempted: number;
  succeeded: number;
  failed: number;
  status: string;
  error: string | null;
};
