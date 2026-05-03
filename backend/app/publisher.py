"""WordPress + Ghost CMS yayınlama servisi.

İki desteklenen platform:
- **WordPress** REST API (uygulama şifresi ile)
- **Ghost** Admin API (admin token ile)

Auth bilgileri Settings'te saklanır, hassas kısımlar mask'lı gösterilir.
"""
from __future__ import annotations

import json as _json
import logging
import re
from datetime import datetime, timedelta
from typing import Any

import httpx

logger = logging.getLogger(__name__)


# ─── WordPress ──────────────────────────────────────────────────────────────

def wp_publish(
    site_url: str, username: str, app_password: str,
    title: str, content_html: str,
    slug: str | None = None, status: str = "draft",
    excerpt: str | None = None, featured_image_url: str | None = None,
    categories: list[int] | None = None, tags: list[str] | None = None,
) -> dict:
    """WordPress REST API ile post oluştur.

    site_url: https://example.com (sona / koyma)
    username: WP kullanıcı adı
    app_password: WP > Profile > Application Passwords
    status: 'draft' (öner) | 'publish' | 'pending'
    """
    site_url = site_url.rstrip("/")
    api_url = f"{site_url}/wp-json/wp/v2/posts"

    auth = httpx.BasicAuth(username, app_password)

    payload: dict[str, Any] = {
        "title": title,
        "content": content_html,
        "status": status,
    }
    if slug:
        payload["slug"] = slug
    if excerpt:
        payload["excerpt"] = excerpt
    if categories:
        payload["categories"] = categories
    if tags:
        # WP API tag isteğinde ID bekler — basit olması için isim ekle, tag oluştur
        tag_ids = _wp_ensure_tags(site_url, auth, tags)
        if tag_ids:
            payload["tags"] = tag_ids

    # Featured image (varsa önce yükle, sonra ID set et)
    if featured_image_url:
        try:
            media_id = _wp_upload_image_from_url(site_url, auth, featured_image_url, title)
            if media_id:
                payload["featured_media"] = media_id
        except Exception as e:
            logger.warning("Featured image yükleme başarısız: %s", e)

    resp = httpx.post(api_url, auth=auth, json=payload, timeout=30.0)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"WordPress publish başarısız: {resp.status_code} {resp.text[:300]}")
    data = resp.json()
    return {
        "id": data.get("id"),
        "link": data.get("link"),
        "status": data.get("status"),
        "edit_link": f"{site_url}/wp-admin/post.php?post={data.get('id')}&action=edit",
    }


def _wp_ensure_tags(site_url: str, auth: httpx.BasicAuth, tag_names: list[str]) -> list[int]:
    """Tag isimlerini ID'ye çevir, yoksa oluştur."""
    ids = []
    for name in tag_names:
        # Önce ara
        resp = httpx.get(f"{site_url}/wp-json/wp/v2/tags", auth=auth, params={"search": name}, timeout=15.0)
        if resp.status_code == 200:
            existing = resp.json()
            match = next((t for t in existing if t.get("name", "").lower() == name.lower()), None)
            if match:
                ids.append(match["id"])
                continue
        # Yoksa oluştur
        try:
            create = httpx.post(f"{site_url}/wp-json/wp/v2/tags", auth=auth, json={"name": name}, timeout=15.0)
            if create.status_code in (200, 201):
                ids.append(create.json().get("id"))
        except Exception:
            pass
    return ids


def _wp_upload_image_from_url(site_url: str, auth: httpx.BasicAuth, image_url: str, title: str) -> int | None:
    """URL'deki görseli indir ve WP media library'ye yükle, ID döner."""
    img_resp = httpx.get(image_url, timeout=30.0, follow_redirects=True)
    if img_resp.status_code != 200:
        return None

    # Content-type'tan uzantı çıkar
    ct = img_resp.headers.get("content-type", "image/png")
    ext = ct.split("/")[-1].split(";")[0]
    filename = f"{re.sub(r'[^a-z0-9]+', '-', title.lower())[:40]}.{ext}"

    upload = httpx.post(
        f"{site_url}/wp-json/wp/v2/media",
        auth=auth,
        headers={
            "Content-Type": ct,
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
        content=img_resp.content,
        timeout=60.0,
    )
    if upload.status_code not in (200, 201):
        logger.warning("WP media upload başarısız: %s", upload.text[:200])
        return None
    return upload.json().get("id")


def wp_test_connection(site_url: str, username: str, app_password: str) -> dict:
    """Bağlantıyı test et — me endpoint'ini çağır."""
    site_url = site_url.rstrip("/")
    auth = httpx.BasicAuth(username, app_password)
    try:
        resp = httpx.get(f"{site_url}/wp-json/wp/v2/users/me", auth=auth, timeout=15.0)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "ok": True,
                "user": data.get("name"),
                "roles": data.get("roles"),
            }
        return {"ok": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ─── Ghost ──────────────────────────────────────────────────────────────────

def _ghost_jwt(admin_api_key: str) -> str:
    """Ghost Admin API için JWT üret. python-jose kullanır (zaten kurulu)."""
    from jose import jwt as _jwt
    if ":" not in admin_api_key:
        raise RuntimeError("Geçersiz Ghost Admin API key formatı (id:secret bekleniyor)")
    key_id, secret = admin_api_key.split(":", 1)
    iat = int(datetime.utcnow().timestamp())
    exp = iat + 5 * 60
    return _jwt.encode(
        {"iat": iat, "exp": exp, "aud": "/admin/"},
        bytes.fromhex(secret),
        algorithm="HS256",
        headers={"kid": key_id},
    )


def ghost_publish(
    site_url: str, admin_api_key: str,
    title: str, html: str,
    slug: str | None = None, status: str = "draft",
    excerpt: str | None = None, feature_image: str | None = None,
    tags: list[str] | None = None,
) -> dict:
    """Ghost Admin API ile post oluştur.

    site_url: https://blog.example.com
    admin_api_key: id:secret formatı (Ghost Admin > Integrations > Custom)
    """
    site_url = site_url.rstrip("/")
    token = _ghost_jwt(admin_api_key)

    payload: dict[str, Any] = {
        "posts": [{
            "title": title,
            "html": html,
            "status": status,
        }]
    }
    p = payload["posts"][0]
    if slug:
        p["slug"] = slug
    if excerpt:
        p["custom_excerpt"] = excerpt[:300]
    if feature_image:
        p["feature_image"] = feature_image
    if tags:
        p["tags"] = [{"name": t} for t in tags]

    resp = httpx.post(
        f"{site_url}/ghost/api/admin/posts/?source=html",
        headers={"Authorization": f"Ghost {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=30.0,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Ghost publish başarısız: {resp.status_code} {resp.text[:300]}")
    data = resp.json().get("posts", [{}])[0]
    return {
        "id": data.get("id"),
        "link": data.get("url"),
        "status": data.get("status"),
        "edit_link": f"{site_url}/ghost/#/editor/post/{data.get('id')}",
    }


def ghost_test_connection(site_url: str, admin_api_key: str) -> dict:
    site_url = site_url.rstrip("/")
    try:
        token = _ghost_jwt(admin_api_key)
        resp = httpx.get(
            f"{site_url}/ghost/api/admin/site/",
            headers={"Authorization": f"Ghost {token}"},
            timeout=15.0,
        )
        if resp.status_code == 200:
            data = resp.json().get("site", {})
            return {"ok": True, "title": data.get("title"), "url": data.get("url")}
        return {"ok": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ─── Markdown → HTML ────────────────────────────────────────────────────────

def markdown_to_html(markdown_text: str) -> str:
    """Basit markdown → HTML dönüşümü. AI çıktısı genelde temiz olduğu için sade."""
    text = markdown_text

    # Code blocks (önce ki diğer pattern'lar bozmasın)
    text = re.sub(r"```(\w+)?\n(.*?)```", lambda m: f"<pre><code>{m.group(2)}</code></pre>", text, flags=re.DOTALL)
    # Inline code
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    # Headers
    text = re.sub(r"^### (.+)$", r"<h3>\1</h3>", text, flags=re.MULTILINE)
    text = re.sub(r"^## (.+)$", r"<h2>\1</h2>", text, flags=re.MULTILINE)
    text = re.sub(r"^# (.+)$", r"<h1>\1</h1>", text, flags=re.MULTILINE)
    # Bold + italic
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*([^*\n]+?)\*", r"<em>\1</em>", text)
    # Links
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    # Lists (basit — her satır)
    lines = text.split("\n")
    out: list[str] = []
    in_list = False
    for line in lines:
        if re.match(r"^[\-\*]\s+(.+)", line):
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{re.sub(r'^[\-\*]\s+', '', line)}</li>")
        elif re.match(r"^\d+\.\s+(.+)", line):
            if not in_list:
                out.append("<ol>")
                in_list = True
            out.append(f"<li>{re.sub(r'^\d+\.\s+', '', line)}</li>")
        else:
            if in_list:
                out.append("</ul>" if "<ul>" in out[-min(20, len(out)):] else "</ol>")
                in_list = False
            out.append(line)
    if in_list:
        out.append("</ul>")

    text = "\n".join(out)
    # Paragraph (boş satırlarla ayrılmış bloklar)
    blocks = re.split(r"\n\s*\n", text)
    blocks_html = []
    for b in blocks:
        b = b.strip()
        if not b:
            continue
        if b.startswith("<") and not b.startswith("<a "):
            blocks_html.append(b)
        else:
            blocks_html.append(f"<p>{b}</p>")
    return "\n\n".join(blocks_html)
