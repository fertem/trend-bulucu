"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang, setLang, brandName } = useLang();

  const NAV = [
    { href: "/", label: t.nav.overview },
    { href: "/chat", label: t.nav.chat },
    { href: "/explorer", label: t.nav.explorer },
    { href: "/opportunities", label: t.nav.opportunities },
    { href: "/categories", label: t.nav.categories },
    { href: "/alerts", label: t.nav.alerts },
    { href: "/seo", label: t.nav.seo },
    { href: "/admin", label: t.nav.admin },
    { href: "/setup", label: t.nav.setup },
    { href: "/settings", label: t.nav.settings },
  ];

  const logout = () => {
    clearToken();
    router.push("/login");
  };

  const displayBrand = brandName || "Trend Dashboard";

  return (
    <aside className="w-56 shrink-0 border-r border-ink-200 bg-white min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-ink-200">
        <div className="text-base font-semibold text-ink-900">{displayBrand}</div>
        <div className="text-xs text-ink-500 mt-0.5">{t.nav.panelSubtitle}</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm transition ${
                active
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-ink-700 hover:bg-ink-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-ink-200 space-y-2">
        <div className="flex gap-1">
          <button
            onClick={() => setLang("tr")}
            className={`flex-1 px-2 py-1.5 rounded-md text-xs transition ${
              lang === "tr"
                ? "bg-brand-50 text-brand-700 border border-brand-100 font-medium"
                : "bg-white text-ink-500 border border-ink-200 hover:bg-ink-50"
            }`}
            title="Türkçe"
          >
            🇹🇷 TR
          </button>
          <button
            onClick={() => setLang("en")}
            className={`flex-1 px-2 py-1.5 rounded-md text-xs transition ${
              lang === "en"
                ? "bg-brand-50 text-brand-700 border border-brand-100 font-medium"
                : "bg-white text-ink-500 border border-ink-200 hover:bg-ink-50"
            }`}
            title="English"
          >
            🇺🇸 EN
          </button>
        </div>
        <button onClick={logout} className="w-full text-left px-3 py-2 rounded-md text-sm text-ink-500 hover:bg-ink-50 hover:text-ink-700 transition">
          {t.nav.logout}
        </button>
      </div>
    </aside>
  );
}
