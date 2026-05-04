"""Anthropic Claude veya OpenAI ChatGPT ile çalışan akıllı analiz katmanı."""
from __future__ import annotations

import json
import re

from .config import settings


DEFAULT_SYSTEM_PROMPT = (
    "Sen Türkçe SEO ve içerik stratejisi asistanısın. "
    "Cevapların kısa, somut ve uygulanabilir olsun."
)


def build_system_prompt(brand: dict | None = None) -> str:
    """Settings'ten gelen marka bağlamıyla system prompt oluştur."""
    if not brand or not brand.get("brand_name"):
        return DEFAULT_SYSTEM_PROMPT
    name = brand.get("brand_name", "")
    desc = brand.get("brand_description", "")
    audience = brand.get("target_audience", "")
    parts = [f"Sen {name} için trend analisti ve içerik stratejistisin."]
    if desc:
        parts.append(f"Marka: {desc}.")
    if audience:
        parts.append(f"Hedef kitle: {audience}.")
    parts.append("Cevapların kısa, somut, marka sesine uygun ve uygulanabilir olsun. Türkçe yaz.")
    return " ".join(parts)


# Geriye dönük uyumluluk için
SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT


def _brand_vars(brand: dict | None) -> tuple[str, str, str, str]:
    """Brand dict'ten (name, desc, audience, url) tuple çıkar — fallback'lerle."""
    b = brand or {}
    name = b.get("brand_name") or "Bu site"
    desc = b.get("brand_description") or "içerik/SEO odaklı bir Türkçe site"
    audience = b.get("target_audience") or "Türkiye'deki kullanıcılar"
    url = b.get("brand_url") or ""
    return name, desc, audience, url


def _lang(brand: dict | None) -> str:
    """AI çıktı dili. Settings'teki language (tr-TR / en-US) → 'tr' veya 'en'."""
    b = brand or {}
    lang = (b.get("language") or "tr-TR").lower()
    if lang.startswith("en"):
        return "en"
    return "tr"


def _lang_instruction(brand: dict | None) -> str:
    """AI prompt'ları için dil yönergesi."""
    if _lang(brand) == "en":
        return "Respond in clear, professional English."
    return "Cevap Türkçe olsun, dilbilgisi temiz."


def _resolve_provider() -> str:
    if settings.anthropic_api_key and (settings.ai_provider == "anthropic" or not settings.openai_api_key):
        return "anthropic"
    if settings.openai_api_key:
        return "openai"
    raise RuntimeError("AI sağlayıcı yapılandırılmamış (ANTHROPIC_API_KEY veya OPENAI_API_KEY ekle).")


def _call_anthropic(prompt: str, max_tokens: int = 800, system: str | None = None) -> str:
    from anthropic import Anthropic

    client = Anthropic(api_key=settings.anthropic_api_key)
    msg = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=max_tokens,
        system=system or DEFAULT_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    parts = []
    for block in msg.content:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    return "\n".join(parts).strip()


def _call_openai(prompt: str, max_tokens: int = 800, json_mode: bool = False, system: str | None = None) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    kwargs = {
        "model": "gpt-4o-mini",
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system or DEFAULT_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    resp = client.chat.completions.create(**kwargs)
    return (resp.choices[0].message.content or "").strip()


def generate(prompt: str, max_tokens: int = 800, json_mode: bool = False, brand: dict | None = None) -> str:
    provider = _resolve_provider()
    system = build_system_prompt(brand) if brand else None
    if provider == "anthropic":
        return _call_anthropic(prompt, max_tokens, system=system)
    return _call_openai(prompt, max_tokens, json_mode=json_mode, system=system)


def _extract_json(text: str) -> dict:
    """LLM cevabından JSON nesnesini çek. JSON çıkmazsa boş dict döner."""
    text = text.strip()
    # Code fence varsa temizle
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except Exception:
        # İçinden JSON çekmeyi dene
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return {}


# ─── Tek kelime açıklaması ──────────────────────────────────────────────────

def explain_trend(keyword: str, growth_pct: float, avg_last_7: float, related: list[str],
                  brand: dict | None = None) -> str:
    rel = ", ".join(related[:8]) if related else "(yok)"
    prompt = (
        f"Anahtar kelime: \"{keyword}\"\n"
        f"Son 7 gün ortalama ilgi (0-100): {avg_last_7:.1f}\n"
        f"Önceki 7 güne göre büyüme: %{growth_pct:.1f}\n"
        f"İlişkili yükselen aramalar: {rel}\n\n"
        "Bu kelimenin neden trend olabileceğini 3-4 cümleyle açıkla. "
        "Mevsimsel etkiler, okul/iş takvimi, popüler kültür veya kullanıcı kaygıları gibi "
        "olası nedenleri belirt. Spekülatif olduğunu net söyle."
    )
    return generate(prompt, max_tokens=400, brand=brand)


def content_ideas(keyword: str, category: str | None, brand: dict | None = None) -> str:
    cat = category or "Genel"
    name, _desc, audience, _url = _brand_vars(brand)
    prompt = (
        f"Anahtar kelime: \"{keyword}\" (kategori: {cat})\n"
        f"{name} için bu kelimeden ilham alan içerik fikirleri üret:\n"
        "- 3 Instagram post fikri (kısa açıklama)\n"
        "- 2 blog yazısı başlığı\n"
        "- 1 kısa video (Reels/Shorts) konsepti\n\n"
        f"Hedef kitle: {audience}. Ton: bilgilendirici, sıcak, satıcı değil."
    )
    return generate(prompt, max_tokens=600, brand=brand)


# ─── SMART: Haftalık AI Özet (Hero card için) ───────────────────────────────

PERIOD_LABELS = {
    "daily": ("Bugün", "son 24 saat", "günlük"),
    "weekly": ("Bu hafta", "son 7 gün", "haftalık"),
    "monthly": ("Bu ay", "son 30 gün", "aylık"),
    "yearly": ("Bu yıl", "son 365 gün", "yıllık"),
}


def weekly_digest(top: list[dict], rising: list[dict], hot: list[dict], opportunities: list[dict],
                  sc_summary: dict | None = None, brand: dict | None = None,
                  period: str = "weekly", projections: list[dict] | None = None) -> dict:
    """Tüm veriden yapılandırılmış özet üret. JSON döner.

    period: daily | weekly | monthly | yearly — prompt'ta zaman kapsamını belirler.
    projections: yıllık periyot için yearly_projection sonuçları (opsiyonel).
    sc_summary: Search Console verisi opsiyonel — varsa AI gerçek pozisyon/CTR'a referans verir.
    """
    period_now, period_window, period_adj = PERIOD_LABELS.get(period, PERIOD_LABELS["weekly"])
    def _fmt(rows):
        return [
            f"  - {r['keyword']} (kategori: {r.get('category') or '?'}, "
            f"son 7g ort: {r['avg_last_7']:.1f}, büyüme: %{r['growth_pct']:.0f})"
            for r in rows[:8]
        ]

    summary_data = (
        "EN ÇOK ARANANLAR:\n" + "\n".join(_fmt(top)) + "\n\n"
        "EN HIZLI YÜKSELENLER:\n" + "\n".join(_fmt(rising)) + "\n\n"
        "HOT UYARILAR (>%50 büyüme):\n" + ("\n".join(_fmt(hot)) if hot else "  (yok)") + "\n\n"
        "FIRSAT KELİMELERİ (yüksek büyüme + düşük doygunluk):\n" + "\n".join(_fmt(opportunities))
    )

    name, desc, audience, url = _brand_vars(brand)
    sc_data_block = ""
    if sc_summary:
        top_q = sc_summary.get("top_queries", [])
        opps = sc_summary.get("opportunities", [])
        page2 = sc_summary.get("page2", [])
        movers = sc_summary.get("movers", [])

        def _q(rows, n=6):
            return [
                f"  - \"{r['query']}\" pos:{r['position']:.1f} | "
                f"{r['clicks']} klik / {r['impressions']} gösterim / CTR %{r['ctr']*100:.1f}"
                for r in rows[:n]
            ]

        def _opp(rows, n=5):
            return [
                f"  - \"{r['query']}\" pos:{r['position']:.1f} | "
                f"{r['impressions']} gösterim ama %{r['ctr']*100:.1f} CTR (potansiyel +{r['potential_clicks']} klik)"
                for r in rows[:n]
            ]

        def _mv(rows, n=5):
            return [
                f"  - \"{r['query']}\" {r['prev_position']:.1f} → {r['position']:.1f} ({r['direction']})"
                for r in rows[:n]
            ]

        sc_data_block = (
            "\n\n--- GERÇEK SEO PERFORMANSI (Google Search Console son 28 gün) ---\n\n"
            f"EN ÇOK TIKLANAN GERÇEK SORGULAR ({url or name}'a):\n" + ("\n".join(_q(top_q)) if top_q else "  (yok)") + "\n\n"
            "BAŞLIK İYİLEŞTİRME FIRSATLARI (gösterim yüksek + CTR düşük):\n" + ("\n".join(_opp(opps)) if opps else "  (yok)") + "\n\n"
            "SAYFA 2'de BEKLEYEN (pos 11-20, küçük itme yeter):\n" + (
                "\n".join([f"  - \"{r['query']}\" pos:{r['position']:.1f} ({r['impressions']} gösterim)" for r in page2[:5]]) if page2 else "  (yok)"
            ) + "\n\n"
            "POZİSYON HAREKETİ:\n" + ("\n".join(_mv(movers)) if movers else "  (yok)")
        )

    projections_block = ""
    if projections:
        proj_lines = []
        for p in projections[:8]:
            if p.get("insufficient_data"):
                continue
            history_str = ", ".join(f"{h['year']}={h['value']}" for h in p.get("history", []))
            cagr = p.get("cagr_pct")
            cagr_str = f"yıllık ~%{cagr:+.0f} büyüme" if cagr is not None else ""
            band = int((p["predicted_high"] - p["predicted_low"]) / 2)
            proj_lines.append(
                f"  - \"{p['keyword']}\" {p['target_month_name']}: "
                f"geçmiş yıllar → {history_str} "
                f"| {p['next_year']} tahmini: {p['predicted']} (±{band}) "
                f"{cagr_str}"
            )
        if proj_lines:
            projections_block = (
                "\n\n--- YILLIK PROJEKSİYON (lineer regresyon + RMSE bandı) ---\n"
                + "\n".join(proj_lines)
            )

    prompt = (
        f"Aşağıda {name} ({desc}) için iki veri seti var:\n"
        "(1) Google Trends — pazar genelinde ne arıyor\n"
        f"(2) Google Search Console — {url or name + ' sitesinin'} GERÇEK arama performansı\n\n"
        f"Bu ikisini birleştirerek {audience} için {period_adj} içerik stratejisi öner. "
        f"Zaman kapsamı: {period_now} ({period_window}).\n\n"
        f"{summary_data}{sc_data_block}{projections_block}\n\n"
        "Sadece geçerli JSON formatında cevap ver (markdown kullanma). Bu yapıyı kullan:\n"
        "{\n"
        f'  "headline": "{period_now}\'ün tek cümlelik özeti (12-18 kelime)",\n'
        '  "highlights": [\n'
        '    {"title": "Öne çıkan başlık", "reason": "1 cümle neden önemli", "keyword": "ilgili kelime"}\n'
        "  ],\n"
        '  "actions": [\n'
        '    {"action": "Yapılacak somut iş", "why": "Hangi veriden çıkardın", "channel": "Instagram | Blog | Reels | Email"}\n'
        "  ],\n"
        '  "watch_out": "Dikkat etmesi gereken 1 risk veya kaçırmaması gereken 1 fırsat"\n'
        "}\n\n"
        f"Tam 3 highlight ve tam 3 action üret. Hepsi Türkçe, kısa ve uygulanabilir olsun. "
        f"{period_adj.capitalize()} kapsamında düşün — günlüksen anlık fırsatlar, yıllıksan stratejik mevsimsellik. "
        "Verideki spesifik kelimelere referans ver. Search Console verisi varsa MUTLAKA "
        "ondaki gerçek pozisyon/CTR/tıklama bilgisine referans ver. Yıllık projeksiyon verisi varsa "
        "\"X kelimesi son 3 yılda %Y büyüyor, yıl sonu için Z bekleniyor\" gibi sayısal öngörü kullan."
    )

    text = generate(prompt, max_tokens=1200, json_mode=True, brand=brand)
    data = _extract_json(text)

    if not data or "headline" not in data:
        return {
            "headline": "Veri yetersiz veya AI cevabı işlenemedi.",
            "highlights": [],
            "actions": [],
            "watch_out": "",
            "raw": text[:500],
        }
    return data


# ─── SMART: Yeni kelime önerileri ───────────────────────────────────────────

def deep_keyword_analysis(keyword: str, profile: dict, yoy: list[dict], vs_history: dict | None,
                          recent_growth_pct: float, category: str | None,
                          sc_data: dict | None = None, brand: dict | None = None) -> dict:
    """Tek kelime için 5 bölümlü derin analiz.

    sc_data: {position, ctr, clicks, impressions, page, prev_position} varsa AI bunu kullanır.
    """
    monthly_lines = []
    if profile:
        for m in range(1, 13):
            p = profile.get(m) or profile.get(str(m))
            if p:
                monthly_lines.append(f"  - {p.get('month_name','?')}: ort {p['mean']:.0f}, lift %{p['lift_pct']:+.0f}")
    monthly_str = "\n".join(monthly_lines) or "  (yok)"

    yoy_lines = []
    by_year = {}
    for p in yoy:
        by_year.setdefault(p["year"], []).append(p["interest"])
    for y in sorted(by_year):
        vals = by_year[y]
        yoy_lines.append(f"  - {y}: yıl ort {sum(vals)/len(vals):.0f}, max {max(vals):.0f}, min {min(vals):.0f}")
    yoy_str = "\n".join(yoy_lines) or "  (yok)"

    vs_str = "yok"
    if vs_history:
        vs_str = (
            f"bu yıl {vs_history['target_month_name']}: {vs_history.get('this_year') or '—'}, "
            f"geçen yıl: {vs_history.get('last_year') or '—'}, "
            f"5y avg: {vs_history.get('history_5y_avg', 0):.0f}, "
            f"tarihsel sapma: %{vs_history.get('delta_vs_history_pct') or 0:+.0f}"
        )

    sc_str = "yok (kelime henüz Search Console'da görünmemiş ya da veri çekilmemiş)"
    if sc_data:
        sc_str = (
            f"Google'da gerçek pozisyon: {sc_data.get('position', 0):.1f}, "
            f"CTR: %{sc_data.get('ctr', 0)*100:.1f}, "
            f"son 28g {sc_data.get('clicks', 0)} tıklama / {sc_data.get('impressions', 0)} gösterim"
        )
        if sc_data.get("prev_position"):
            sc_str += f" (önceki dönem pos: {sc_data['prev_position']:.1f})"
        if sc_data.get("page"):
            sc_str += f" — sayfa: {sc_data['page']}"

    prompt = (
        f"Kelime: \"{keyword}\" (kategori: {category or 'belirsiz'})\n"
        f"Son 7g büyüme (Trends): %{recent_growth_pct:+.0f}\n"
        f"GERÇEK SEO DURUMU (Search Console): {sc_str}\n\n"
        f"5 YILLIK AYLIK PROFİL:\n{monthly_str}\n\n"
        f"YIL YIL ÖZET:\n{yoy_str}\n\n"
        f"BU AY DURUM: {vs_str}\n\n"
        f"{_brand_vars(brand)[0]} ({_brand_vars(brand)[1]}) için bu kelimeyi derinlemesine analiz et. Hedef kitle: {_brand_vars(brand)[2]}.\n"
        "Sadece geçerli JSON cevap ver:\n"
        "{\n"
        '  "executive_summary": "1 cümle özet — bu kelime hakkında bilinmesi gereken tek şey",\n'
        '  "historical_pattern": "5y davranış paterni (3-4 cümle) — hangi aylar zirve, hangileri dip, neden",\n'
        '  "current_state": "Şu anki durumun tarihsel bağlamda yorumu (2-3 cümle)",\n'
        '  "next_3_months": "Önümüzdeki 3 ay için öngörü (3-4 cümle, geçmiş yıl paternine ve şu anki ivmeye dayalı)",\n'
        '  "recommendations": [\n'
        '    {"action": "Yapılacak somut iş (eylem cümle)", "timing": "Ne zaman (hafta/ay)", "channel": "Kanal: Blog/Instagram/Reels/Email/SEO"}\n'
        "  ],\n"
        '  "risk_or_opportunity": "Dikkat edilmesi gereken risk VEYA kaçırılmaması gereken fırsat (1-2 cümle)"\n'
        "}\n\n"
        f"Tam 4 recommendation üret. Türkçe, somut, {_brand_vars(brand)[0]}'in yapabileceği işler. "
        "Verideki spesifik aylara/yıllara referans ver — genel konuşma. "
        "Search Console verisi varsa: gerçek pozisyona ve CTR'a göre öncelik ver. "
        "Sayfa 2'de (pos 11-20) ise → küçük iyileştirme öner. "
        "CTR çok düşükse → title revizyonu öner. "
        "Hiç görünmüyorsa → on-page SEO + içerik üretimi öner."
    )

    text = generate(prompt, max_tokens=1600, json_mode=True, brand=brand)
    data = _extract_json(text)
    if not data or "executive_summary" not in data:
        return {"executive_summary": "AI cevabı işlenemedi", "raw": text[:500]}
    return data


def content_brief(keyword: str, category: str | None, monthly_peak_month: str | None = None,
                  brand: dict | None = None) -> dict:
    """Tam içerik brief'i — blog outline + sosyal hook'lar."""
    name, desc, audience, _ = _brand_vars(brand)
    peak = f"Tarihsel zirve ayı: {monthly_peak_month}" if monthly_peak_month else ""
    prompt = (
        f"Kelime: \"{keyword}\" (kategori: {category or 'belirsiz'})\n{peak}\n\n"
        f"{name} ({desc}, hedef kitle: {audience}) için bu kelime üzerine "
        "yayınlanacak içerik için kapsamlı brief hazırla.\n\n"
        "Sadece JSON:\n"
        "{\n"
        '  "title_options": ["başlık 1", "başlık 2", "başlık 3"],\n'
        '  "target_audience": "Hedef kitle profili (1-2 cümle: yaş, kaygı, niyet)",\n'
        '  "search_intent": "informational | commercial | navigational | transactional + kısa açıklama",\n'
        '  "outline": [\n'
        '    {"h2": "Ana başlık", "h3": ["Alt başlık 1", "Alt başlık 2"], "talking_points": "Anlatılacaklar (1-2 cümle)"}\n'
        "  ],\n"
        '  "key_takeaways": ["Okuyucunun çıkarımı 1", "çıkarımı 2", "çıkarımı 3"],\n'
        '  "social_hooks": {\n'
        '    "instagram": "Instagram post için bir başlık veya hook (1 cümle)",\n'
        '    "reels": "Kısa video açılış cümlesi"\n'
        "  },\n"
        '  "secondary_keywords": ["yan SEO kelime 1", "kelime 2", "kelime 3", "kelime 4"]\n'
        "}\n\n"
        "Tam 5 H2 outline elemanı. Her H2 için 2-3 H3. Türkçe. "
        "Tonu sıcak ve bilgilendirici (annelere yönelik), satış değil."
    )

    text = generate(prompt, max_tokens=1800, json_mode=True, brand=brand)
    data = _extract_json(text)
    if not data or "outline" not in data:
        return {"title_options": [], "outline": [], "raw": text[:500]}
    return data


def seasonal_outlook_insight(month_name: str, top_by_lift: list[dict], top_by_volume: list[dict],
                             brand: dict | None = None) -> dict:
    """5 yıllık mevsimsel veriden bu ay için AI özeti."""
    def _fmt(rows, field):
        return [
            f"  - {r['keyword']} (kategori: {r.get('category') or '?'}, "
            f"{month_name} ort: {r['month_avg']:.0f}, lift: %{r.get('lift_pct', 0):+.0f}, "
            f"yıl zirvesi: {r.get('peak_month_name','?')})"
            for r in rows[:8]
        ]

    summary = (
        f"AY: {month_name}\n\n"
        f"TARIHSEL OLARAK {month_name.upper()} AYINDA EN ÇOK ZIPLAYANLAR (lift > yıl ortalaması):\n"
        + "\n".join(_fmt(top_by_lift[:8], "lift_pct")) + "\n\n"
        f"TARIHSEL OLARAK {month_name.upper()} AYINDA EN YÜKSEK HACİM:\n"
        + "\n".join(_fmt(top_by_volume[:8], "month_avg"))
    )

    prompt = (
        f"{_brand_vars(brand)[0]} ({_brand_vars(brand)[1]}, hedef: {_brand_vars(brand)[2]}) için son 5 yılın Google Trends "
        f"verisinden {month_name} ayı tarihsel mevsimsellik raporu:\n\n{summary}\n\n"
        "Sadece geçerli JSON formatında cevap ver:\n"
        "{\n"
        '  "headline": "Bu ay için tek cümlelik tahmin/öngörü (15-20 kelime)",\n'
        '  "predictions": [\n'
        '    {"keyword": "kelime", "what_to_expect": "tarihsel veriye dayalı kısa tahmin", "reason": "neden (geçmiş yıllara referans)"}\n'
        "  ],\n"
        '  "early_movers": "Hangi içerikleri ŞİMDİDEN hazırlamalı (1-2 cümle)",\n'
        '  "context": "Mevsimsel arka plan (okul takvimi, tatil, sınav vb. — 1-2 cümle)"\n'
        "}\n\n"
        "Tam 4 prediction üret. Tarihsel verideki spesifik kelimelere referans ver, genel konuşma. Türkçe."
    )

    text = generate(prompt, max_tokens=1200, json_mode=True, brand=brand)
    data = _extract_json(text)
    if not data or "headline" not in data:
        return {"headline": "AI cevabı işlenemedi", "predictions": [], "early_movers": "", "context": "", "raw": text[:500]}
    return data


def find_similar_keywords(keyword: str, category: str | None, current_tracked: list[str],
                          brand: dict | None = None) -> dict:
    """Bir kelimeye semantik olarak benzer 10 kelime üret — kategorize ederek."""
    tracked_str = ", ".join(current_tracked[:30]) if current_tracked else "(yok)"
    prompt = (
        f"Kelime: \"{keyword}\" (kategori: {category or 'belirsiz'})\n"
        f"Şu an takip edilenler (örnek): {tracked_str}\n\n"
        f"{_brand_vars(brand)[0]} ({_brand_vars(brand)[1]}, hedef: {_brand_vars(brand)[2]}) için, "
        "bu kelimeye semantik olarak benzer 10 farklı arama kelimesi üret. "
        "Türkçe, gerçek Google'da aratılan formda olsun.\n\n"
        "Sadece JSON cevap ver:\n"
        "{\n"
        '  "similar_keywords": [\n'
        '    {"keyword": "...", "similarity_type": "eş anlamlı | yan kavram | soru formu | uzun varyant | farklı dil", "reason": "neden yakın (1 cümle)"}\n'
        "  ]\n"
        "}\n\n"
        "Tam 10 öneri ver. Çeşitli olsun: bir kısmı eş anlamlı, bir kısmı yan kavram, "
        "bir kısmı soru formu (\"X nedir\", \"X nasıl\"), bir kısmı uzun-kuyruk varyant. "
        "Mevcut takip edilenleri tekrar etme."
    )
    text = generate(prompt, max_tokens=1200, json_mode=True, brand=brand)
    data = _extract_json(text)
    if "similar_keywords" not in data:
        return {"similar_keywords": [], "raw": text[:500]}

    cur_set = {c.lower().strip() for c in current_tracked}
    cur_set.add(keyword.lower().strip())
    cleaned = []
    for s in data["similar_keywords"]:
        kw = (s.get("keyword") or "").lower().strip()
        if not kw or len(kw) < 3 or kw in cur_set:
            continue
        cleaned.append({
            "keyword": kw,
            "similarity_type": s.get("similarity_type", "yakın"),
            "reason": s.get("reason", ""),
        })
    return {"similar_keywords": cleaned}


def long_tail_variants(seed_keyword: str, brand: dict | None = None) -> dict:
    """Bir kelimenin uzun-kuyruk varyantlarını üret."""
    prompt = (
        f"Tohum kelime: \"{seed_keyword}\"\n\n"
        f"{_brand_vars(brand)[0]} ({_brand_vars(brand)[1]}) hedefiyle, bu kelimenin "
        "uzun-kuyruk arama varyantlarını üret. Gerçek Google'da aratılan formda Türkçe.\n\n"
        "5 kategori için her biri 3-4 varyant:\n"
        "- Soru formları (örn. \"X nedir\", \"X nasıl yapılır\")\n"
        "- Yaş bazlı (örn. \"7 yaş için X\", \"10 yaş X\")\n"
        "- Karşılaştırma (örn. \"X mi Y mi\", \"X vs Y\")\n"
        "- Yıl bazlı / güncel (örn. \"X 2026\", \"en iyi X 2026\")\n"
        "- Modifier/sıfat (örn. \"ücretsiz X\", \"online X\", \"evde X\")\n\n"
        "Sadece JSON:\n"
        "{\n"
        '  "variants": [\n'
        '    {"keyword": "...", "type": "soru | yaş | karşılaştırma | yıl | modifier"}\n'
        "  ]\n"
        "}\n\n"
        "Toplam 15-18 varyant. Mantıklı, gerçekten aratılabilir olanlar."
    )
    text = generate(prompt, max_tokens=1200, json_mode=True, brand=brand)
    data = _extract_json(text)
    if "variants" not in data:
        return {"variants": [], "raw": text[:500]}

    cleaned = []
    seen = set()
    for v in data["variants"]:
        kw = (v.get("keyword") or "").lower().strip()
        if not kw or len(kw) < 4 or kw in seen:
            continue
        seen.add(kw)
        cleaned.append({"keyword": kw, "type": v.get("type", "diğer")})
    return {"variants": cleaned}


def suggest_new_keywords(rising_pool: list[str], current: list[str], category_hints: list[str],
                         brand: dict | None = None) -> dict:
    """AI takip listesine eklenecek yeni kelimeler önerir."""
    rising_str = ", ".join(rising_pool[:30]) if rising_pool else "(yok)"
    current_str = ", ".join(current[:50])
    cats_str = ", ".join(set(category_hints)) if category_hints else "Eğitim, Kodlama, Ebeveynlik, Psikoloji"

    name, desc, audience, _ = _brand_vars(brand)
    prompt = (
        f"{name} için Türkiye Google Trends takip listesini genişletmek istiyorum.\n\n"
        f"ŞU AN TAKİP EDİLENLER ({len(current)} kelime):\n{current_str}\n\n"
        f"GOOGLE'DA YÜKSELEN ALAKALI ARAMALAR (bunları yorumla):\n{rising_str}\n\n"
        f"İLGİ ALANIMIZDAKİ KATEGORİLER: {cats_str}\n\n"
        f"Hedef kitle: {audience}. {name} = {desc}.\n\n"
        "Sadece JSON cevap ver:\n"
        "{\n"
        '  "suggestions": [\n'
        '    {"keyword": "tam kelime grubu (lowercase)", "reason": "neden takip edilmeli (1 cümle)", "category": "Eğitim|Kodlama|Ebeveynlik|Psikoloji|Eğlence"}\n'
        "  ]\n"
        "}\n\n"
        "5 öneri ver. Türkçe, mevcut listede olmayan, yüksek değerli kelimeler seç. "
        "Çok genel olanlardan kaçın (örn: \"çocuk\" tek başına kötü, \"5 yaş çocuk gelişimi\" iyi)."
    )

    text = generate(prompt, max_tokens=900, json_mode=True, brand=brand)
    data = _extract_json(text)
    if "suggestions" not in data:
        return {"suggestions": [], "raw": text[:500]}

    # Filtrele: zaten takip edilenler ve çok kısa olanlar
    current_set = {c.lower().strip() for c in current}
    cleaned = []
    for s in data["suggestions"]:
        kw = (s.get("keyword") or "").lower().strip()
        if not kw or len(kw) < 4:
            continue
        if kw in current_set:
            continue
        cleaned.append({
            "keyword": kw,
            "reason": s.get("reason", ""),
            "category": s.get("category", "Diğer"),
        })
    return {"suggestions": cleaned}


# ─── Setup wizard AI helpers ────────────────────────────────────────────────

def detect_industry(brand_name: str, brand_description: str, brand_url: str = "") -> dict:
    """Marka açıklamasından sektör + 5-10 öneri çıkar."""
    prompt = (
        f"Marka adı: {brand_name}\n"
        f"Açıklama: {brand_description}\n"
        f"URL: {brand_url}\n\n"
        "Bu markanın hangi sektörde olduğunu tespit et ve trend takibi için "
        "öneriler ver.\n\n"
        "Sadece JSON cevap:\n"
        "{\n"
        '  "industry": "education | ecommerce | saas | content | healthcare | finance | other",\n'
        '  "industry_label": "Türkçe sektör adı",\n'
        '  "category_template": "education | ecommerce | saas | content (en uygun şablon)",\n'
        '  "default_audience": "Önerilen hedef kitle (1 cümle, Türkçe)",\n'
        '  "rationale": "Bu kararı neden verdin (1-2 cümle)"\n'
        "}"
    )
    text = generate(prompt, max_tokens=400, json_mode=True)
    return _extract_json(text) or {
        "industry": "other",
        "industry_label": "Belirsiz",
        "category_template": "content",
        "default_audience": "",
        "rationale": "",
    }


def suggest_seed_keywords_from_brand(brand_name: str, brand_description: str,
                                     audience: str, count: int = 15) -> dict:
    """Markaya/sektöre göre başlangıç tohum kelime listesi öner."""
    prompt = (
        f"Marka: {brand_name}\n"
        f"Açıklama: {brand_description}\n"
        f"Hedef kitle: {audience or 'belirsiz'}\n\n"
        f"Bu marka için Türkçe Google Trends takibinde başlangıç olabilecek "
        f"{count} farklı tohum kelime öner. Hem brand-related hem konu-related olsun. "
        "Marka adını kelime olarak ekleme (zaten branded). "
        "Mevsimsel olabilecekler dahil — ay/yıl ekleme.\n\n"
        "JSON:\n"
        "{\n"
        '  "keywords": [\n'
        '    {"keyword": "...", "type": "konu | soru | yan-konu | rakip-eş", "reason": "neden bu kelime"}\n'
        "  ]\n"
        "}"
    )
    text = generate(prompt, max_tokens=1400, json_mode=True)
    data = _extract_json(text)
    items = []
    seen = set()
    for it in data.get("keywords", []):
        kw = (it.get("keyword") or "").lower().strip()
        if not kw or len(kw) < 3 or kw in seen:
            continue
        seen.add(kw)
        items.append({
            "keyword": kw,
            "type": it.get("type", ""),
            "reason": it.get("reason", ""),
        })
    return {"keywords": items[:count]}


def suggest_categories_from_brand(brand_name: str, brand_description: str) -> dict:
    """Markaya özel kategori önerileri (sıfırdan)."""
    prompt = (
        f"Marka: {brand_name}\n"
        f"Açıklama: {brand_description}\n\n"
        "Bu marka için kelime takibi yaparken kullanılacak 5-7 kategori öner. "
        "Her kategoriye eşleşmesi için tetikleyici kelimeler ekle (Türkçe, virgülle ayır).\n\n"
        "JSON:\n"
        "{\n"
        '  "categories": [\n'
        '    {"name": "Kategori adı", "triggers": "kelime1,kelime2,kelime3", "reason": "neden bu kategori"}\n'
        "  ]\n"
        "}"
    )
    text = generate(prompt, max_tokens=900, json_mode=True)
    data = _extract_json(text)
    out = []
    for c in data.get("categories", []):
        name = (c.get("name") or "").strip()
        if not name:
            continue
        out.append({
            "name": name,
            "triggers": c.get("triggers", ""),
            "reason": c.get("reason", ""),
        })
    return {"categories": out}


# ─── Article Writer (içerik fırsatından tam yazı) ──────────────────────────

def article_outline(keyword: str, brand: dict | None = None, category: str | None = None,
                    related_queries: list[str] | None = None) -> dict:
    """Bir kelime için tam yazı taslağı: başlık + meta + outline + key points."""
    rel_str = ", ".join(related_queries[:8]) if related_queries else "(yok)"
    cat_str = category or "belirsiz"
    prompt = (
        f"Kelime: \"{keyword}\"\n"
        f"Kategori: {cat_str}\n"
        f"İlgili yükselen sorgular: {rel_str}\n\n"
        "Bu kelimeye odaklı, SEO uyumlu blog yazısı için kapsamlı taslak hazırla.\n\n"
        "JSON:\n"
        "{\n"
        '  "title": "SEO başlığı (50-60 karakter, hedef kelime başta)",\n'
        '  "slug": "url-slug-formati",\n'
        '  "meta_description": "150-160 karakter meta description",\n'
        '  "h1": "H1 başlığı",\n'
        '  "intro_hook": "Giriş paragrafı için 2-3 cümlelik açılış",\n'
        '  "outline": [\n'
        '    {"h2": "Bölüm başlığı", "h3": ["Alt başlık 1", "Alt başlık 2"], "key_points": ["nokta 1", "nokta 2", "nokta 3"]}\n'
        "  ],\n"
        '  "faq": [\n'
        '    {"q": "Soru?", "a": "Kısa cevap (2-3 cümle)"}\n'
        "  ],\n"
        '  "key_takeaways": ["nokta 1", "nokta 2", "nokta 3"],\n'
        '  "internal_link_ideas": ["bağlanılabilecek konu 1", "konu 2"],\n'
        '  "secondary_keywords": ["yan kelime 1", "yan kelime 2", "yan kelime 3"],\n'
        '  "estimated_word_count": 1500\n'
        "}\n\n"
        "5-7 H2 başlık + her birinde 2-3 H3 olsun. 4-5 FAQ. Hepsi Türkçe."
    )
    text = generate(prompt, max_tokens=2000, json_mode=True, brand=brand)
    return _extract_json(text) or {}


def article_full_text(keyword: str, outline: dict, brand: dict | None = None,
                      tone: str = "bilgilendirici, sıcak, satıcı değil") -> str:
    """Outline'dan tam markdown yazı üret."""
    title = outline.get("title", keyword)
    h1 = outline.get("h1", title)
    intro = outline.get("intro_hook", "")
    sections = outline.get("outline", [])
    faqs = outline.get("faq", [])
    takeaways = outline.get("key_takeaways", [])

    sections_str = "\n".join([
        f"- H2: {s.get('h2','')}\n  H3'ler: {', '.join(s.get('h3',[]))}\n  Anahtar noktalar: {'; '.join(s.get('key_points',[]))}"
        for s in sections
    ])
    faqs_str = "\n".join([f"- {f.get('q','')}: {f.get('a','')[:80]}..." for f in faqs])

    prompt = (
        f"Hedef kelime: \"{keyword}\"\n"
        f"Başlık: {title}\n"
        f"H1: {h1}\n"
        f"Açılış: {intro}\n\n"
        f"BÖLÜMLER:\n{sections_str}\n\n"
        f"FAQ TASLAKLARI:\n{faqs_str}\n\n"
        f"ÇIKARIMLAR: {'; '.join(takeaways)}\n\n"
        f"Bu yapıda **markdown formatında tam blog yazısı** yaz.\n"
        f"Ton: {tone}.\n"
        "Kurallar:\n"
        "- En az 1200, en fazla 2000 kelime\n"
        "- H1 (#), H2 (##), H3 (###) hiyerarşisini kullan\n"
        "- Her bölüm 150-300 kelime\n"
        "- Hedef kelime ilk paragrafta + en az 3 H2'de geçsin (doğal kullanım)\n"
        "- Yan kelimeleri serpiştir\n"
        "- FAQ bölümünü en sona koy: ## Sıkça Sorulan Sorular\n"
        "- Liste, blockquote, bold kullan\n"
        "- Türkçe imla kuralları, dilbilgisi temiz\n"
        "- Sadece markdown çıktısı ver, başka açıklama yazma"
    )

    # Tam yazı için JSON mode kapalı, max_tokens yüksek
    return generate(prompt, max_tokens=4000, json_mode=False, brand=brand)


def _build_chat_system(messages: list[dict], context: dict, brand: dict | None) -> tuple[str, list[dict]]:
    """Chat için system prompt + temizlenmiş messages — stream + non-stream paylaşır."""
    name, desc, audience, _ = _brand_vars(brand)

    ctx_lines = []
    if context.get("top_trending"):
        ctx_lines.append("EN ÇOK ARANANLAR (son 7g):")
        for t in context["top_trending"][:8]:
            ctx_lines.append(f"  - {t['keyword']} (büyüme %{t.get('growth_pct', 0):.0f}, son 7g {t.get('avg_last_7', 0):.0f})")

    if context.get("hot_alerts"):
        ctx_lines.append("\nHOT UYARILAR (>%50 büyüme):")
        for h in context["hot_alerts"][:5]:
            ctx_lines.append(f"  - {h['keyword']} (%{h.get('growth_pct', 0):.0f})")

    if context.get("gsc_top"):
        ctx_lines.append("\nSEARCH CONSOLE — EN ÇOK TIKLANAN:")
        for g in context["gsc_top"][:5]:
            ctx_lines.append(f"  - \"{g['query']}\" pos:{g['position']:.1f}, {g['clicks']} klik, %{g['ctr']*100:.1f} CTR")

    if context.get("gsc_opportunities"):
        ctx_lines.append("\nBAŞLIK İYİLEŞTİRME FIRSATLARI:")
        for o in context["gsc_opportunities"][:5]:
            ctx_lines.append(f"  - \"{o['query']}\" {o['impressions']} gösterim ama %{o['ctr']*100:.1f} CTR")

    if context.get("content_gaps"):
        ctx_lines.append("\nİÇERİK BOŞLUKLARI:")
        for g in context["content_gaps"][:5]:
            ctx_lines.append(f"  - {g['keyword']}")

    if context.get("seasonality_now"):
        ctx_lines.append(f"\nBU AY ({context['seasonality_now'].get('month_name','?')}) ZIRVEDE:")
        for s in context["seasonality_now"].get("by_lift", [])[:5]:
            ctx_lines.append(f"  - {s['keyword']} (lift %{s.get('lift_pct', 0):+.0f})")

    # Google Ads hacmi — opsiyonel, sadece veri varsa eklenir
    if context.get("ads_volumes"):
        ctx_lines.append("\nGOOGLE ADS — gerçek aylık arama hacmi:")
        for v in context["ads_volumes"][:8]:
            comp = v.get("competition", "?")
            ctx_lines.append(
                f"  - \"{v['keyword']}\": ~{v.get('volume_monthly', 0)}/ay, "
                f"rekabet: {comp}"
            )

    context_str = "\n".join(ctx_lines) if ctx_lines else "(veri henüz toplanmamış)"
    lang_instr = _lang_instruction(brand)

    system_prompt = (
        f"Sen {name} ({desc}) için trend ve SEO uzmanısın. Hedef kitle: {audience}.\n\n"
        f"Aşağıda kullanıcının panelindeki güncel veri var — sorulara bu veriye dayalı somut cevap ver.\n\n"
        f"--- VERİ ---\n{context_str}\n--- ---\n\n"
        f"{lang_instr} Kısa (2-4 paragraf), maddeli liste ve markdown kullan. "
        f"Veride olmayan bir şeye 'bu verim yok' de — uydurma. "
        f"Aksiyon önerirken 'sayfa şu, yazı şu, kanal şu' formatında somut ol."
    )

    cleaned = [{"role": m["role"], "content": m["content"]} for m in messages if m.get("role") in ("user", "assistant")]
    return system_prompt, cleaned


def chat_with_data_stream(messages: list[dict], context: dict, brand: dict | None = None):
    """Streaming chat — token token yield eder (SSE için)."""
    system_prompt, cleaned = _build_chat_system(messages, context, brand)
    provider = _resolve_provider()

    if provider == "anthropic":
        from anthropic import Anthropic
        client = Anthropic(api_key=settings.anthropic_api_key)
        with client.messages.stream(
            model="claude-sonnet-4-5",
            max_tokens=1500,
            system=system_prompt,
            messages=cleaned,
        ) as stream:
            for text in stream.text_stream:
                yield text
    else:
        from openai import OpenAI
        client = OpenAI(api_key=settings.openai_api_key)
        all_msgs = [{"role": "system", "content": system_prompt}, *cleaned]
        stream = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=1500,
            messages=all_msgs,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta


def chat_with_data(messages: list[dict], context: dict, brand: dict | None = None) -> str:
    """Veri-aware AI sohbet. Context: trends top, gsc top, gaps, brand info, son özet vs."""
    name, desc, audience, _ = _brand_vars(brand)

    # Context'i prompt'a gömecek formatla
    ctx_lines = []
    if context.get("top_trending"):
        ctx_lines.append("EN ÇOK ARANANLAR (son 7g):")
        for t in context["top_trending"][:8]:
            ctx_lines.append(f"  - {t['keyword']} (büyüme %{t.get('growth_pct', 0):.0f}, son 7g {t.get('avg_last_7', 0):.0f})")

    if context.get("hot_alerts"):
        ctx_lines.append("\nHOT UYARILAR (>%50 büyüme):")
        for h in context["hot_alerts"][:5]:
            ctx_lines.append(f"  - {h['keyword']} (%{h.get('growth_pct', 0):.0f})")

    if context.get("gsc_top"):
        ctx_lines.append("\nSEARCH CONSOLE — EN ÇOK TIKLANAN GERÇEK SORGULAR:")
        for g in context["gsc_top"][:5]:
            ctx_lines.append(f"  - \"{g['query']}\" pos:{g['position']:.1f}, {g['clicks']} klik, %{g['ctr']*100:.1f} CTR")

    if context.get("gsc_opportunities"):
        ctx_lines.append("\nBAŞLIK İYİLEŞTİRME FIRSATLARI:")
        for o in context["gsc_opportunities"][:5]:
            ctx_lines.append(f"  - \"{o['query']}\" {o['impressions']} gösterim ama %{o['ctr']*100:.1f} CTR (potansiyel +{o.get('potential_clicks',0)} klik)")

    if context.get("content_gaps"):
        ctx_lines.append("\nİÇERİK BOŞLUKLARI (sitende olmayan trend kelimeler):")
        for g in context["content_gaps"][:5]:
            ctx_lines.append(f"  - {g['keyword']} (öncelik {g.get('priority', 0):.0f})")

    if context.get("seasonality_now"):
        ctx_lines.append(f"\nBU AY ({context['seasonality_now'].get('month_name','?')}) TARİHSEL OLARAK YÜKSELEN:")
        for s in context["seasonality_now"].get("by_lift", [])[:5]:
            ctx_lines.append(f"  - {s['keyword']} (lift %{s.get('lift_pct', 0):+.0f})")

    context_str = "\n".join(ctx_lines) if ctx_lines else "(veri henüz toplanmamış)"

    system_prompt = (
        f"Sen {name} ({desc}) için trend ve SEO uzmanısın. Hedef kitle: {audience}.\n\n"
        f"Aşağıda kullanıcının panelindeki güncel veri var — sorulara bu veriye dayalı somut cevap ver. "
        f"Genel konuşma, spesifik kelimelere referans ver.\n\n"
        f"--- VERİ ---\n{context_str}\n--- ---\n\n"
        "Cevaplar Türkçe, kısa (2-4 paragraf), maddeli liste ve markdown kullanabilirsin. "
        "Veride olmayan bir şeye 'bu verim yok' de — uydurma. "
        "Aksiyon önerirken 'sayfa şu, yazı şu, kanal şu' formatında somut ol."
    )

    # Generic generate yerine messages array kullan (multi-turn)
    provider = _resolve_provider()
    if provider == "anthropic":
        from anthropic import Anthropic
        client = Anthropic(api_key=settings.anthropic_api_key)
        msg = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1500,
            system=system_prompt,
            messages=[{"role": m["role"], "content": m["content"]} for m in messages if m["role"] in ("user", "assistant")],
        )
        parts = []
        for block in msg.content:
            if getattr(block, "type", None) == "text":
                parts.append(block.text)
        return "\n".join(parts).strip()
    else:
        from openai import OpenAI
        client = OpenAI(api_key=settings.openai_api_key)
        all_msgs = [{"role": "system", "content": system_prompt}]
        for m in messages:
            if m["role"] in ("user", "assistant"):
                all_msgs.append({"role": m["role"], "content": m["content"]})
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=1500,
            messages=all_msgs,
        )
        return (resp.choices[0].message.content or "").strip()


def cover_image(prompt_hint: str, keyword: str, style: str = "modern, minimalist, vibrant") -> str:
    """DALL-E 3 ile blog kapak görseli üret. Sadece OpenAI desteklenir."""
    if not settings.openai_api_key:
        raise RuntimeError("Kapak görseli için OPENAI_API_KEY gerekli (Anthropic image generation desteklemiyor)")

    from openai import OpenAI
    client = OpenAI(api_key=settings.openai_api_key)

    img_prompt = (
        f"Blog post cover image for an article about '{keyword}'. "
        f"Context: {prompt_hint}. "
        f"Style: {style}. Wide aspect ratio. No text overlays. "
        "Professional, blog-friendly, social-media-ready."
    )
    resp = client.images.generate(
        model="dall-e-3",
        prompt=img_prompt,
        size="1792x1024",
        quality="standard",
        n=1,
    )
    return resp.data[0].url


def schema_markup(keyword: str, outline: dict, brand: dict | None = None) -> dict:
    """Article + FAQ + HowTo schema.org JSON-LD üret."""
    name, desc, audience, url = _brand_vars(brand)
    title = outline.get("title", keyword)
    meta = outline.get("meta_description", "")
    h1 = outline.get("h1", title)
    faqs = outline.get("faq", [])
    sections = outline.get("outline", [])
    slug = outline.get("slug", keyword.replace(" ", "-").lower())

    article = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": h1,
        "description": meta,
        "author": {"@type": "Organization", "name": name, "url": url or None},
        "publisher": {
            "@type": "Organization",
            "name": name,
            "url": url or None,
        },
        "inLanguage": "tr",
        "mainEntityOfPage": f"{url}/{slug}" if url else None,
    }

    faq_schema = None
    if faqs and len(faqs) >= 2:
        faq_schema = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": f["q"],
                    "acceptedAnswer": {"@type": "Answer", "text": f["a"]},
                }
                for f in faqs
                if f.get("q") and f.get("a")
            ],
        }

    howto_schema = None
    # H2 başlıkları "nasıl" / "adım" içeriyorsa HowTo schema öner
    has_howto = any("nasıl" in (s.get("h2") or "").lower() or "adım" in (s.get("h2") or "").lower() for s in sections)
    if has_howto and sections:
        howto_schema = {
            "@context": "https://schema.org",
            "@type": "HowTo",
            "name": h1,
            "description": meta,
            "step": [
                {
                    "@type": "HowToStep",
                    "name": s.get("h2"),
                    "text": "; ".join(s.get("key_points", []))[:200],
                }
                for s in sections
            ],
        }

    return {
        "article": article,
        "faq": faq_schema,
        "howto": howto_schema,
    }


def refresh_existing_post(slug: str, title: str, current_keyword: str,
                          gsc_data: dict | None = None, related_rising: list[str] | None = None,
                          brand: dict | None = None) -> dict:
    """Mevcut bir blog yazısı için AI revizyon önerisi.

    GSC datası varsa pozisyon/CTR'a bakar. Rising queries varsa "şu konu eklendi" önerir.
    """
    rel = ", ".join(related_rising[:8]) if related_rising else "(yok)"

    gsc_str = "Yok"
    if gsc_data:
        gsc_str = (
            f"pozisyon: {gsc_data.get('position', 0):.1f}, "
            f"CTR: %{gsc_data.get('ctr', 0)*100:.1f}, "
            f"son 28g {gsc_data.get('clicks', 0)} klik / {gsc_data.get('impressions', 0)} gösterim"
        )

    prompt = (
        f"Mevcut yazı: \"{title}\" (slug: {slug})\n"
        f"Hedef kelime: {current_keyword}\n"
        f"Search Console durumu: {gsc_str}\n"
        f"İlgili yükselen sorgular: {rel}\n\n"
        "Bu yazıya AI revizyon önerisi yap. JSON döner:\n"
        "{\n"
        '  "needs_refresh": true | false,\n'
        '  "urgency": "high | medium | low",\n'
        '  "reasons": ["sebep 1", "sebep 2"],\n'
        '  "suggested_changes": [\n'
        '    {"type": "title | meta | new-section | update-section | add-faq | internal-link", '
        '"description": "ne değiştir", "rationale": "neden"}\n'
        "  ],\n"
        '  "new_sections_to_add": ["yeni eklenmesi gereken H2 başlık 1", "..."],\n'
        '  "estimated_impact": "Beklenen etki (1 cümle, traffic uplift veya CTR boost gibi)"\n'
        "}\n\n"
        "Eğer pozisyon iyi (top 5) ve CTR yüksek ise needs_refresh=false. "
        "Eğer pos sayfa 2'de veya CTR düşükse high urgency. "
        "Yükselen sorgularda yeni alt-başlık önerileri ver. Türkçe."
    )

    text = generate(prompt, max_tokens=1200, json_mode=True, brand=brand)
    data = _extract_json(text)
    if not data:
        return {"needs_refresh": False, "raw": text[:500]}
    return data


def cluster_keywords_ai(keywords: list[str], brand: dict | None = None) -> dict:
    """AI ile semantik kelime kümeleme — cluster + cluster name + her kelimeye cluster ata."""
    if len(keywords) < 3:
        return {"clusters": []}

    kws_str = "\n".join(f"  - {k}" for k in keywords[:60])  # max 60 kelime

    prompt = (
        f"Aşağıda takip edilen anahtar kelimeler var. Bunları **semantik olarak küme**. "
        f"Her küme için bir konu başlığı ver (1-3 kelime). Her kelime tam bir kümeye ait olmalı.\n\n"
        f"KELIMELER:\n{kws_str}\n\n"
        "JSON cevap:\n"
        "{\n"
        '  "clusters": [\n'
        '    {"name": "Küme adı", "theme": "Tema açıklaması (1 cümle)", "keywords": ["kelime 1", "kelime 2", "..."]}\n'
        "  ]\n"
        "}\n\n"
        "5-10 küme yap. Tek kelimelik kümelerden kaçın (mümkünse en az 2 kelime/küme). Türkçe."
    )

    text = generate(prompt, max_tokens=1800, json_mode=True, brand=brand)
    data = _extract_json(text)
    if not data or "clusters" not in data:
        return {"clusters": []}

    # Validate ve normalize
    valid_clusters = []
    for c in data["clusters"]:
        name = (c.get("name") or "").strip()
        kws = [k.strip() for k in c.get("keywords", []) if isinstance(k, str)]
        if name and kws:
            valid_clusters.append({
                "name": name,
                "theme": c.get("theme", ""),
                "keywords": kws,
                "size": len(kws),
            })
    return {"clusters": valid_clusters}


# ─── AI Article Editor (chat-like) ─────────────────────────────────────────

def edit_article(current_markdown: str, instruction: str, brand: dict | None = None) -> dict:
    """Mevcut markdown yazıya AI ile düzenleme uygula.

    Örnek instruction: "Giriş paragrafını kısalt ve daha samimi yap"
    """
    lang_instr = _lang_instruction(brand)
    name, desc, audience, _ = _brand_vars(brand)

    prompt = (
        f"Aşağıda mevcut blog yazısının markdown'u var. Kullanıcı bir düzenleme istiyor.\n\n"
        f"MEVCUT YAZI:\n```markdown\n{current_markdown}\n```\n\n"
        f"DÜZENLEME İSTEĞİ: {instruction}\n\n"
        f"Marka bağlamı: {name} ({desc}), hedef: {audience}.\n\n"
        f"Tüm yazıyı bu isteğe göre yeniden ver. Sadece markdown çıktısı, başka açıklama yok. "
        f"Hedef kelime kullanımını koru, başlık yapısını koru ama istek doğrultusunda iyileştir. "
        f"{lang_instr}"
    )
    new_markdown = generate(prompt, max_tokens=4000, json_mode=False, brand=brand)
    # Code fence varsa temizle
    new_markdown = re.sub(r"^```(?:markdown)?\s*", "", new_markdown.strip())
    new_markdown = re.sub(r"\s*```$", "", new_markdown.strip())

    # Değişim özetini de iste (ayrı çağrı kısa olur)
    summary_prompt = (
        f"Önceki ve yeni yazı arasındaki değişiklikleri 2-3 madde halinde özetle "
        f"(örn. 'Giriş paragrafı 3 cümleden 1 cümleye indirildi'). "
        f"Sadece 2-3 satırlık liste, başlık yok. {lang_instr}\n\n"
        f"İSTEK: {instruction}"
    )
    try:
        summary = generate(summary_prompt, max_tokens=300, brand=brand)
    except Exception:
        summary = ""

    return {
        "markdown": new_markdown,
        "summary": summary.strip(),
        "length": len(new_markdown),
        "word_count": len(new_markdown.split()),
    }


# ─── SEO Scorecard ─────────────────────────────────────────────────────────

def seo_scorecard(keyword: str, markdown: str, outline: dict | None = None,
                  brand: dict | None = None) -> dict:
    """Yazıyı 0-100 puanla SEO açısından değerlendir."""
    # Programatik kontroller (AI'ye gerek yok bunlar için)
    word_count = len(markdown.split())
    keyword_lower = keyword.lower()
    md_lower = markdown.lower()

    # Hedef kelime kullanımı
    keyword_count = md_lower.count(keyword_lower)
    keyword_density = (keyword_count / word_count * 100) if word_count else 0

    # H2 / H3 say
    h2_count = len(re.findall(r"^## ", markdown, re.MULTILINE))
    h3_count = len(re.findall(r"^### ", markdown, re.MULTILINE))

    # İlk paragrafta kelime var mı?
    first_para = markdown.split("\n\n")[0] if markdown else ""
    keyword_in_first = keyword_lower in first_para.lower()

    # Başlıklarda kelime kaç kez geçiyor?
    headings = re.findall(r"^#{1,3}\s+(.+)$", markdown, re.MULTILINE)
    keyword_in_headings = sum(1 for h in headings if keyword_lower in h.lower())

    # Liste / bold kullanımı (engagement signal)
    has_lists = bool(re.search(r"^[\-\*]\s", markdown, re.MULTILINE)) or bool(re.search(r"^\d+\.\s", markdown, re.MULTILINE))
    has_bold = "**" in markdown
    has_questions = "?" in markdown  # FAQ veya soru başlıkları

    # Skor hesaplama (her kategori 0-100, ağırlıklı toplam)
    scores = {}

    # Length score (1500-2500 ideal)
    if word_count < 500:
        scores["length"] = 30
    elif word_count < 1000:
        scores["length"] = 60
    elif word_count <= 2500:
        scores["length"] = 100
    elif word_count <= 4000:
        scores["length"] = 80
    else:
        scores["length"] = 60

    # Keyword usage (1-3% ideal density, ilk paragrafta olmalı)
    if 0.5 <= keyword_density <= 3.0:
        scores["keyword_density"] = 100
    elif keyword_density < 0.5:
        scores["keyword_density"] = 40
    elif keyword_density <= 5:
        scores["keyword_density"] = 70
    else:
        scores["keyword_density"] = 30  # over-optimization

    scores["keyword_in_first_para"] = 100 if keyword_in_first else 30

    # Headings (en az 3 H2)
    if h2_count >= 5:
        scores["headings"] = 100
    elif h2_count >= 3:
        scores["headings"] = 80
    elif h2_count >= 1:
        scores["headings"] = 50
    else:
        scores["headings"] = 0

    # Keyword in headings (en az 2 H2'de geçmeli)
    if keyword_in_headings >= 3:
        scores["keyword_in_headings"] = 100
    elif keyword_in_headings >= 2:
        scores["keyword_in_headings"] = 80
    elif keyword_in_headings >= 1:
        scores["keyword_in_headings"] = 50
    else:
        scores["keyword_in_headings"] = 0

    # Engagement signals
    eng_score = 0
    if has_lists: eng_score += 35
    if has_bold: eng_score += 30
    if has_questions: eng_score += 35
    scores["engagement"] = eng_score

    # Total weighted score
    total = round(
        scores["length"] * 0.20 +
        scores["keyword_density"] * 0.20 +
        scores["keyword_in_first_para"] * 0.10 +
        scores["headings"] * 0.15 +
        scores["keyword_in_headings"] * 0.20 +
        scores["engagement"] * 0.15
    )

    verdict = "mükemmel" if total >= 90 else "iyi" if total >= 75 else "orta" if total >= 60 else "geliştirilmeli"

    # AI ile somut iyileştirme önerileri
    issues = []
    if scores["length"] < 80: issues.append(f"kelime sayısı {word_count} (1500-2500 ideal)")
    if scores["keyword_density"] < 70: issues.append(f"kelime yoğunluğu %{keyword_density:.1f}")
    if not keyword_in_first: issues.append("hedef kelime ilk paragrafta yok")
    if scores["keyword_in_headings"] < 80: issues.append(f"hedef kelime {keyword_in_headings} H2'de geçiyor")
    if scores["headings"] < 80: issues.append(f"sadece {h2_count} H2 var")
    if scores["engagement"] < 70: issues.append("liste / bold / soru yetersiz")

    suggestions = []
    if issues:
        try:
            lang_instr = _lang_instruction(brand)
            sug_prompt = (
                f"Bir blog yazısının SEO açısından şu sorunları var:\n"
                + "\n".join(f"- {i}" for i in issues) + "\n\n"
                f"Hedef kelime: \"{keyword}\". Her sorun için 1 satır somut çözüm öner. "
                f"JSON: {{\"suggestions\": [\"öneri 1\", \"öneri 2\", ...]}}. {lang_instr}"
            )
            sug_text = generate(sug_prompt, max_tokens=500, json_mode=True, brand=brand)
            sug_data = _extract_json(sug_text)
            if sug_data and "suggestions" in sug_data:
                suggestions = sug_data["suggestions"]
        except Exception:
            pass

    return {
        "total_score": total,
        "verdict": verdict,
        "breakdown": scores,
        "metrics": {
            "word_count": word_count,
            "keyword_density_pct": round(keyword_density, 2),
            "keyword_count": keyword_count,
            "h2_count": h2_count,
            "h3_count": h3_count,
            "keyword_in_first_para": keyword_in_first,
            "keyword_in_headings": keyword_in_headings,
            "has_lists": has_lists,
            "has_bold": has_bold,
            "has_questions": has_questions,
        },
        "issues": issues,
        "suggestions": suggestions,
    }


# ─── Internal Linking Suggester ────────────────────────────────────────────

def suggest_internal_links(keyword: str, markdown: str, site_pages: list[dict],
                           brand: dict | None = None) -> dict:
    """Yazıdaki bölümlerden, sitedeki ilgili sayfalara link öner.

    site_pages: [{"slug": "...", "title": "...", "url": "...", "description": "..."}]
    """
    if not site_pages:
        return {"suggestions": []}

    pages_str = "\n".join(
        f"- {p.get('slug')} | title: {p.get('title','')[:80]} | url: {p.get('url','')}"
        for p in site_pages[:50]
    )

    # Markdown içinden H2 bölümlerini çıkar (her bölüm için ayrı link önerisi)
    h2_pattern = re.compile(r"^##\s+(.+?)$(.+?)(?=^##\s|\Z)", re.MULTILINE | re.DOTALL)
    sections = h2_pattern.findall(markdown[:10000])  # ilk 10K karakter
    sections_str = "\n".join(f"## {h}\n{c[:300]}..." for h, c in sections[:8])

    lang_instr = _lang_instruction(brand)

    prompt = (
        f"Hedef kelime: \"{keyword}\"\n\n"
        f"YAZIDAKİ BÖLÜMLER (ilk 8):\n{sections_str}\n\n"
        f"SİTEDE MEVCUT SAYFALAR:\n{pages_str}\n\n"
        f"Bu yazının her bölümü için, sitedeki en alakalı 1-2 sayfaya **internal link önerisi** yap. "
        f"Sadece anlamlı bağlantılar öner — zorlama. Her öneride:\n"
        f"- Hangi cümlede / bölümde link kelimesi olarak ne kullanılacak (anchor text)\n"
        f"- Hangi sayfaya link verilecek (slug)\n"
        f"- Neden alakalı (1 cümle)\n\n"
        f"JSON cevap:\n"
        f"{{\n"
        f'  "suggestions": [\n'
        f'    {{\n'
        f'      "section_h2": "ilgili H2 başlığı",\n'
        f'      "anchor_text": "linkleştirilecek metin",\n'
        f'      "target_slug": "hedef sayfa slug",\n'
        f'      "target_url": "tam URL",\n'
        f'      "reason": "neden alakalı"\n'
        f'    }}\n'
        f"  ]\n"
        f"}}\n\n"
        f"5-10 öneri yeter. Tekrar etme. {lang_instr}"
    )
    text = generate(prompt, max_tokens=1500, json_mode=True, brand=brand)
    data = _extract_json(text)
    if not data or "suggestions" not in data:
        return {"suggestions": []}
    return data


# ─── Search Intent Classifier ───────────────────────────────────────────────

def classify_search_intent(keywords: list[str], brand: dict | None = None) -> dict:
    """Her kelimeyi 4 intent kategorisinden birine ata."""
    if not keywords:
        return {"items": []}
    kws_str = "\n".join(f"- {k}" for k in keywords[:60])
    lang_instr = _lang_instruction(brand)

    prompt = (
        f"Aşağıdaki anahtar kelimeleri arama niyetine (search intent) göre sınıflandır.\n\n"
        f"INTENT KATEGORİLERİ:\n"
        f"- informational: bilgi arıyor (nedir, nasıl, ne zaman)\n"
        f"- commercial: araştırma + karşılaştırma (en iyi, vs, alternatif)\n"
        f"- transactional: satın alma niyeti (fiyat, sipariş, indirim)\n"
        f"- navigational: belirli bir marka/site arıyor\n\n"
        f"KELIMELER:\n{kws_str}\n\n"
        f"JSON cevap:\n"
        f"{{\n"
        f'  "items": [\n'
        f'    {{"keyword": "...", "intent": "informational|commercial|transactional|navigational", "confidence": 0.0-1.0, "reasoning": "kısa neden"}}\n'
        f"  ]\n"
        f"}}\n\n"
        f"{lang_instr}"
    )
    text = generate(prompt, max_tokens=2500, json_mode=True, brand=brand)
    data = _extract_json(text)
    if not data or "items" not in data:
        return {"items": []}
    return data


# ─── Keyword Difficulty (KD) ───────────────────────────────────────────────

def estimate_keyword_difficulty(keyword: str, sc_data: dict | None = None,
                                volume_monthly: int | None = None,
                                category: str | None = None,
                                brand: dict | None = None) -> dict:
    """Bir kelimenin SEO'da ranking zorluğunu tahmin et (0-100)."""
    sc_str = "yok"
    if sc_data:
        sc_str = (
            f"şu an pos {sc_data.get('position', 0):.1f}, "
            f"{sc_data.get('impressions', 0)} gösterim, %{sc_data.get('ctr', 0)*100:.1f} CTR"
        )

    vol_str = f"{volume_monthly}" if volume_monthly else "bilinmiyor"
    lang_instr = _lang_instruction(brand)

    prompt = (
        f"Anahtar kelime: \"{keyword}\"\n"
        f"Kategori: {category or 'belirsiz'}\n"
        f"Aylık tahmini hacim: {vol_str}\n"
        f"Mevcut SEO durumu: {sc_str}\n\n"
        f"Bu kelimenin Google'da rank etme zorluğunu (Keyword Difficulty) tahmin et.\n"
        f"0-100 skala: 0=çok kolay, 50=orta, 100=çok zor (büyük marka kapmış).\n\n"
        f"Düşünmen gereken:\n"
        f"- Bu kelimede genelde kim rank ediyor (büyük markalar, e-ticaret, niş bloglar)?\n"
        f"- Search intent ne (commercial keywords genelde zor, informational orta)\n"
        f"- Hacim büyükse rekabet çok\n"
        f"- Eğer mevcut pozisyon iyi (top 10) ise başarmak görece kolay olabilir\n\n"
        f"JSON cevap:\n"
        f"{{\n"
        f'  "kd_score": 0-100,\n'
        f'  "verdict": "kolay|orta|zor|çok zor",\n'
        f'  "competition_type": "büyük markalar | niş bloglar | e-ticaret | karışık | bilinmiyor",\n'
        f'  "winning_strategy": "Bu kelimede başarmak için ne yapmalı (1-2 cümle, somut)",\n'
        f'  "estimated_time_to_rank": "Tahmini süre (örn. 2-3 ay, 6+ ay, çok zor)"\n'
        f"}}\n\n"
        f"{lang_instr}"
    )
    text = generate(prompt, max_tokens=600, json_mode=True, brand=brand)
    data = _extract_json(text)
    if not data:
        return {"kd_score": 50, "verdict": "orta", "competition_type": "bilinmiyor", "winning_strategy": "", "estimated_time_to_rank": ""}
    return data


# ─── People Also Ask ───────────────────────────────────────────────────────

def people_also_ask(keyword: str, count: int = 20, brand: dict | None = None) -> dict:
    """AnswerThePublic tarzı — Google'ın 'şunu da soruyor' tarzında soru kelimeleri üret."""
    name, desc, audience, _ = _brand_vars(brand)
    lang_instr = _lang_instruction(brand)

    prompt = (
        f"Anahtar kelime: \"{keyword}\"\n"
        f"Bağlam: {name} ({desc}) için, hedef kitle: {audience}.\n\n"
        f"Bu kelime için Google'da insanların sorabileceği {count} farklı soru üret. "
        f"Soru tipleri çeşitli olsun (nedir, nasıl, ne zaman, neden, kim, hangi, kaç, "
        f"karşılaştırma, en iyi, listeleme).\n\n"
        f"JSON cevap:\n"
        f"{{\n"
        f'  "questions": [\n'
        f'    {{\n'
        f'      "question": "tam soru (Google\'da aratılır gibi)",\n'
        f'      "type": "nedir | nasıl | ne zaman | neden | kim | hangi | kaç | karşılaştırma | liste | diğer",\n'
        f'      "search_intent": "informational | commercial | transactional",\n'
        f'      "content_angle": "Bu sorudan üretilebilecek içerik fikri (1 cümle)"\n'
        f'    }}\n'
        f"  ],\n"
        f'  "topic_clusters": ["bu sorulardan çıkan ana temalar (3-5 madde)"]\n'
        f"}}\n\n"
        f"Türkçe sorular gerçek hayatta aratılan formatta olsun. {lang_instr}"
    )
    text = generate(prompt, max_tokens=2500, json_mode=True, brand=brand)
    data = _extract_json(text)
    if not data or "questions" not in data:
        return {"questions": [], "topic_clusters": []}
    # Validate ve filtrele
    out = []
    for q in data["questions"]:
        question = (q.get("question") or "").strip()
        if not question or len(question) < 5:
            continue
        out.append({
            "question": question,
            "type": q.get("type", "diğer"),
            "search_intent": q.get("search_intent", "informational"),
            "content_angle": q.get("content_angle", ""),
        })
    return {
        "questions": out[:count],
        "topic_clusters": data.get("topic_clusters", []),
    }


def article_social_pack(keyword: str, outline: dict, brand: dict | None = None) -> dict:
    """Yazı için sosyal medya paketi: Instagram, Reels, X, LinkedIn."""
    title = outline.get("title", keyword)
    takeaways = outline.get("key_takeaways", [])
    prompt = (
        f"Yazı: \"{title}\"\n"
        f"Hedef kelime: {keyword}\n"
        f"Anahtar çıkarımlar: {'; '.join(takeaways)}\n\n"
        "Bu blog yazısının duyurusu için sosyal medya paketi hazırla.\n\n"
        "JSON:\n"
        "{\n"
        '  "instagram_caption": "Instagram post yazısı (max 2200 karakter, hashtag dahil)",\n'
        '  "instagram_hashtags": ["etiket1", "etiket2", "..."],\n'
        '  "reels_script": "30 saniyelik Reels/Shorts senaryosu (sahne sahne)",\n'
        '  "twitter_thread": ["tweet 1 (280 karakter)", "tweet 2", "tweet 3", "..."],\n'
        '  "linkedin_post": "LinkedIn paylaşımı (profesyonel ton, 800-1200 karakter)",\n'
        '  "email_subject": "E-posta bülteni başlığı"\n'
        "}\n\n"
        "Hepsi Türkçe. Hashtag'ler alakalı ve marka uyumlu olsun."
    )
    text = generate(prompt, max_tokens=1500, json_mode=True, brand=brand)
    return _extract_json(text) or {}
